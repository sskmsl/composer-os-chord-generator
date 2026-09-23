import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { DeletionRecord } from "@/features/storage/db"
import { DELETION_RETENTION_DAYS, deletionRepository } from "@/features/storage/deletionRepository"
import { folderRepository, progressionRepository } from "@/features/storage/progressionRepository"
import { migrateFolder, type Folder } from "@/types/folder"
import { migrateSavedProgression, type SavedProgression } from "@/types/progression"

const FOLDERS_TABLE = "folders"
const PROGRESSIONS_TABLE = "progressions"
/**
 * 削除の記録(tombstone)。supabase/chord-generator-deletions.sql で作成する。
 * まだ作成されていないプロジェクトでは、削除の記録はこの端末の中だけで働き、
 * クラウド経由の伝播は行わない(エラーにもしない)。
 */
const DELETIONS_TABLE = "chord_deletions"

/** テーブルが存在しない(SQL未実行)ことを示すエラーか */
function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === "PGRST205" || error.code === "42P01" || /does not exist|could not find the table/i.test(error.message ?? "")
}

async function pushDeletion(tombstone: DeletionRecord): Promise<void> {
  if (!supabase) return
  const owner_id = await ownerId()
  if (!owner_id) return
  const { error } = await supabase
    .from(DELETIONS_TABLE)
    .upsert({ id: tombstone.id, owner_id, kind: tombstone.kind, deleted_at: tombstone.deletedAt })
  if (error && !isMissingTableError(error)) throw error
}

/** クラウドの削除の記録。テーブルが無ければ null */
async function fetchRemoteDeletions(): Promise<DeletionRecord[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from(DELETIONS_TABLE).select("id, kind, deleted_at")
  if (error) {
    if (isMissingTableError(error)) return null
    throw error
  }
  return (data ?? []).map((r) => ({ id: r.id as string, kind: r.kind as DeletionRecord["kind"], deletedAt: r.deleted_at as string }))
}

/** バックアップから復元した項目など、意図して戻した項目の削除の記録を消す */
export async function clearRemoteDeletions(ids: readonly string[]): Promise<void> {
  if (!supabase || ids.length === 0) return
  try {
    const { error } = await supabase.from(DELETIONS_TABLE).delete().in("id", [...ids])
    if (error && !isMissingTableError(error)) throw error
  } catch {
    notifySyncFailure("削除記録の解除")
  }
}

async function ownerId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

/**
 * 同期失敗の通知。書き込みのたびに毎回トーストを出すと連続操作(一括保存・
 * 並び替え等)で埋め尽くされるため、短時間の連発は1回にまとめる。
 * ローカル(IndexedDB)への保存自体は既に完了している前提で、
 * 「クラウドには反映できていない」ことだけを知らせる。
 */
let lastSyncErrorToastAt = 0
const SYNC_ERROR_TOAST_THROTTLE_MS = 8000

function notifySyncFailure(action: string): void {
  const now = Date.now()
  if (now - lastSyncErrorToastAt < SYNC_ERROR_TOAST_THROTTLE_MS) return
  lastSyncErrorToastAt = now
  toast.error(`クラウド同期に失敗しました(${action})`, {
    description: "この端末には保存されています。ネットワーク状況を確認するか、後でもう一度お試しください。",
    duration: 8000,
  })
}

export async function pushFolder(folder: Folder): Promise<void> {
  if (!supabase) return
  try {
    const owner_id = await ownerId()
    if (!owner_id) return
    const { error } = await supabase.from(FOLDERS_TABLE).upsert({ id: folder.id, owner_id, data: folder })
    if (error) throw error
  } catch {
    notifySyncFailure("フォルダの保存")
  }
}

export async function deleteFolderRemote(tombstone: DeletionRecord): Promise<void> {
  if (!supabase) return
  try {
    const { error } = await supabase.from(FOLDERS_TABLE).delete().eq("id", tombstone.id)
    if (error) throw error
    await pushDeletion(tombstone)
  } catch {
    notifySyncFailure("フォルダの削除")
  }
}

export async function pushProgression(progression: SavedProgression): Promise<void> {
  if (!supabase) return
  try {
    const owner_id = await ownerId()
    if (!owner_id) return
    const { error } = await supabase
      .from(PROGRESSIONS_TABLE)
      .upsert({ id: progression.id, owner_id, data: progression })
    if (error) throw error
  } catch {
    notifySyncFailure("進行の保存")
  }
}

export async function deleteProgressionRemote(tombstone: DeletionRecord): Promise<void> {
  if (!supabase) return
  try {
    const { error } = await supabase.from(PROGRESSIONS_TABLE).delete().eq("id", tombstone.id)
    if (error) throw error
    await pushDeletion(tombstone)
  } catch {
    notifySyncFailure("進行の削除")
  }
}

/**
 * id単位でローカルとリモートをマージする。両方に存在する項目は preferRemote で
 * 判定した側を採用し、片方にしか存在しない項目は無条件に残す。
 * 削除の伝播はこの後の applyTombstones で行う(削除の記録がある項目だけを落とす)。
 */
export function mergeById<T extends { id: string }>(
  local: T[],
  remote: T[],
  preferRemote: (local: T, remote: T) => boolean,
): T[] {
  const byId = new Map<string, T>(local.map((item) => [item.id, item]))
  for (const item of remote) {
    const existing = byId.get(item.id)
    if (!existing || preferRemote(existing, item)) byId.set(item.id, item)
  }
  return [...byId.values()]
}

/**
 * 削除の記録(tombstone)がある項目を落とす。ただし削除より後に保存し直された項目
 * (同じidで作り直した・復元した等)は残す。記録の無い項目には一切触れないので、
 * 未同期のローカルの新しい保存が消えることはない。
 */
export function applyTombstones<T extends { id: string }>(
  items: readonly T[],
  tombstones: readonly DeletionRecord[],
  timeOf: (item: T) => string,
): T[] {
  const deletedAt = new Map(tombstones.map((t) => [t.id, t.deletedAt]))
  return items.filter((item) => {
    const at = deletedAt.get(item.id)
    return at === undefined || timeOf(item) > at
  })
}

/** 同じidの削除記録は新しい方を残し、保持期間を過ぎたものは捨てる */
export function mergeTombstones(
  local: readonly DeletionRecord[],
  remote: readonly DeletionRecord[],
  now = new Date(),
): DeletionRecord[] {
  const cutoff = new Date(now.getTime() - DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const byId = new Map<string, DeletionRecord>()
  for (const t of [...local, ...remote]) {
    const existing = byId.get(t.id)
    if (!existing || t.deletedAt > existing.deletedAt) byId.set(t.id, t)
  }
  return [...byId.values()].filter((t) => t.deletedAt >= cutoff)
}

/**
 * ログイン直後に1回呼ぶ。ローカルとリモートをid単位でマージし(新しい方を残す)、
 * その結果をローカルにも反映しつつリモートへも書き戻して両者を一致させる。
 * かつては「リモートにデータがあれば丸ごと置換」だったため、端末をまたいで
 * 作業した際に未同期のローカル変更が消えるリスクがあった。
 */
export async function syncPullAndReconcile(): Promise<void> {
  if (!supabase) return

  const [
    { data: remoteFoldersRaw, error: folderErr },
    { data: remoteProgressionsRaw, error: progErr },
    localFolders,
    localProgressions,
  ] = await Promise.all([
    supabase.from(FOLDERS_TABLE).select("data"),
    supabase.from(PROGRESSIONS_TABLE).select("data"),
    folderRepository.list(),
    progressionRepository.list(),
  ])
  if (folderErr || progErr) throw folderErr ?? progErr
  const [localTombstones, remoteTombstones] = await Promise.all([deletionRepository.list(), fetchRemoteDeletions()])
  const tombstones = mergeTombstones(localTombstones, remoteTombstones ?? [])

  // リモートは古いバージョンのアプリから書かれた形式(例: Folderにupdated Atが無い、
  // SavedProgressionにbeatsが無い等)の可能性があるため、ローカルと同じく
  // 移行関数を通して揃えてからマージする
  const remoteFolders = (remoteFoldersRaw ?? []).map((r) => migrateFolder(r.data as Folder))
  const remoteProgressions = (remoteProgressionsRaw ?? []).map((r) =>
    migrateSavedProgression(r.data as SavedProgression),
  )

  // フォルダ・進行のどちらも updatedAt/savedAt を比較し、より新しい方を残す。
  // その後、どちらかの端末で削除した項目(削除の記録がある項目)を落とす
  const mergedFolders = applyTombstones(
    mergeById(localFolders, remoteFolders, (local, remote) => remote.updatedAt >= local.updatedAt),
    tombstones.filter((t) => t.kind === "folder"),
    (f) => f.updatedAt,
  )
  const mergedProgressions = applyTombstones(
    mergeById(localProgressions, remoteProgressions, (local, remote) => remote.savedAt >= local.savedAt),
    tombstones.filter((t) => t.kind === "progression"),
    (p) => p.savedAt,
  )

  await folderRepository.replaceAll(mergedFolders)
  await progressionRepository.replaceAll(mergedProgressions)
  await deletionRepository.replaceAll(tombstones)

  // クラウドに残っている削除済みの行(削除時の通信失敗など)を消し、この端末だけが持つ削除の記録を
  // クラウドへ送る。マージ結果はリモートにも書き戻し、どちらの端末から見ても一致させる
  const keptFolderIds = new Set(mergedFolders.map((f) => f.id))
  const keptProgressionIds = new Set(mergedProgressions.map((p) => p.id))
  const staleRemoteFolders = remoteFolders.filter((f) => !keptFolderIds.has(f.id)).map((f) => f.id)
  const staleRemoteProgressions = remoteProgressions.filter((p) => !keptProgressionIds.has(p.id)).map((p) => p.id)
  const remoteTombstoneIds = new Set((remoteTombstones ?? []).map((t) => t.id))
  void Promise.all([
    ...(staleRemoteFolders.length > 0 ? [supabase.from(FOLDERS_TABLE).delete().in("id", staleRemoteFolders)] : []),
    ...(staleRemoteProgressions.length > 0 ? [supabase.from(PROGRESSIONS_TABLE).delete().in("id", staleRemoteProgressions)] : []),
    ...(remoteTombstones ? tombstones.filter((t) => !remoteTombstoneIds.has(t.id)).map(pushDeletion) : []),
    ...mergedFolders.map(pushFolder),
    ...mergedProgressions.map(pushProgression),
  ]).catch(() => notifySyncFailure("同期の書き戻し"))
}
