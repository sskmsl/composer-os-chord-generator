import { supabase } from "@/lib/supabase"
import { folderRepository, progressionRepository } from "@/features/storage/progressionRepository"
import type { Folder } from "@/types/folder"
import type { SavedProgression } from "@/types/progression"

const FOLDERS_TABLE = "folders"
const PROGRESSIONS_TABLE = "progressions"

async function ownerId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function pushFolder(folder: Folder): Promise<void> {
  if (!supabase) return
  const owner_id = await ownerId()
  if (!owner_id) return
  await supabase.from(FOLDERS_TABLE).upsert({ id: folder.id, owner_id, data: folder })
}

export async function deleteFolderRemote(id: string): Promise<void> {
  if (!supabase) return
  await supabase.from(FOLDERS_TABLE).delete().eq("id", id)
}

export async function pushProgression(progression: SavedProgression): Promise<void> {
  if (!supabase) return
  const owner_id = await ownerId()
  if (!owner_id) return
  await supabase.from(PROGRESSIONS_TABLE).upsert({ id: progression.id, owner_id, data: progression })
}

export async function deleteProgressionRemote(id: string): Promise<void> {
  if (!supabase) return
  await supabase.from(PROGRESSIONS_TABLE).delete().eq("id", id)
}

/**
 * ログイン直後に1回呼ぶ。リモートにデータがあればそれをローカルの正とし、
 * リモートが空(初回ログイン)ならローカルの既存データをアップロードして種付けする。
 */
export async function syncPullAndReconcile(): Promise<void> {
  if (!supabase) return

  const [{ data: remoteFolders, error: folderErr }, { data: remoteProgressions, error: progErr }] =
    await Promise.all([
      supabase.from(FOLDERS_TABLE).select("data"),
      supabase.from(PROGRESSIONS_TABLE).select("data"),
    ])
  if (folderErr || progErr) throw folderErr ?? progErr

  const hasRemote = (remoteFolders?.length ?? 0) > 0 || (remoteProgressions?.length ?? 0) > 0

  if (hasRemote) {
    const folders = (remoteFolders ?? []).map((r) => r.data as Folder)
    const progressions = (remoteProgressions ?? []).map((r) => r.data as SavedProgression)
    await folderRepository.replaceAll(folders)
    await progressionRepository.replaceAll(progressions)
  } else {
    const [localFolders, localProgressions] = await Promise.all([
      folderRepository.list(),
      progressionRepository.list(),
    ])
    await Promise.all([...localFolders.map(pushFolder), ...localProgressions.map(pushProgression)])
  }
}
