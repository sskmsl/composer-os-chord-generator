import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { folderRepository, progressionRepository } from "@/features/storage/progressionRepository"
import type { Folder } from "@/types/folder"
import { migrateSavedProgression, type SavedProgression } from "@/types/progression"

const FOLDERS_TABLE = "folders"
const PROGRESSIONS_TABLE = "progressions"

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

export async function deleteFolderRemote(id: string): Promise<void> {
  if (!supabase) return
  try {
    const { error } = await supabase.from(FOLDERS_TABLE).delete().eq("id", id)
    if (error) throw error
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

export async function deleteProgressionRemote(id: string): Promise<void> {
  if (!supabase) return
  try {
    const { error } = await supabase.from(PROGRESSIONS_TABLE).delete().eq("id", id)
    if (error) throw error
  } catch {
    notifySyncFailure("進行の削除")
  }
}

/**
 * id単位でローカルとリモートをマージする。両方に存在する項目は preferRemote で
 * 判定した側を採用し、片方にしか存在しない項目は無条件に残す(=削除は同期しない)。
 * このアプリには削除の伝播(tombstone)機構がないため、「他端末での意図的な削除が
 * 復活してしまう」可能性と「まだ同期できていないローカルの新しい保存が消える」
 * 可能性はトレードオフになるが、創作物を扱うツールとしては後者の方が被害が大きいため、
 * 前者(削除の復活)を許容し、常にデータを残す側に倒す。
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

  const remoteFolders = (remoteFoldersRaw ?? []).map((r) => r.data as Folder)
  // リモートは古いバージョンのアプリから書かれた形式(例: beatsフィールドが無い)の
  // 可能性があるため、ローカルと同じくmigrateSavedProgressionを通して揃える
  const remoteProgressions = (remoteProgressionsRaw ?? []).map((r) =>
    migrateSavedProgression(r.data as SavedProgression),
  )

  // フォルダには更新日時がないため、両方に存在する場合はリモートを正とする
  // (既存の「リモートが正」という前提を、削除しない形に緩めただけ)
  const mergedFolders = mergeById(localFolders, remoteFolders, () => true)
  // 進行は savedAt を比較し、より新しい方を残す
  const mergedProgressions = mergeById(
    localProgressions,
    remoteProgressions,
    (local, remote) => remote.savedAt >= local.savedAt,
  )

  await folderRepository.replaceAll(mergedFolders)
  await progressionRepository.replaceAll(mergedProgressions)

  // マージ結果をリモートにも書き戻し、次回の同期でどちらの端末から見ても一致するようにする
  void Promise.all([...mergedFolders.map(pushFolder), ...mergedProgressions.map(pushProgression)])
}
