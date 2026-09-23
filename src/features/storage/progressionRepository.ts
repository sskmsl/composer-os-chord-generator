import type { SavedProgression } from "@/types/progression"
import { migrateSavedProgression } from "@/types/progression"
import type { Folder } from "@/types/folder"
import { migrateFolder } from "@/types/folder"
import { FOLDER_STORE, getDb, PROGRESSION_STORE } from "./db"
import { deletionRepository } from "./deletionRepository"
import {
  deleteFolderRemote,
  deleteProgressionRemote,
  pushFolder,
  pushProgression,
} from "@/features/sync/supabaseSync"

/** 進行の永続化。IndexedDBが正で、書き込みのたびにベストエフォートでSupabaseにも反映する */
export const progressionRepository = {
  async list(): Promise<SavedProgression[]> {
    const db = await getDb()
    const items = await db.getAll(PROGRESSION_STORE)
    return items.map(migrateSavedProgression)
  },

  async save(progression: SavedProgression): Promise<void> {
    const db = await getDb()
    await db.put(PROGRESSION_STORE, progression)
    void pushProgression(progression)
  },

  async saveMany(progressions: SavedProgression[]): Promise<void> {
    const db = await getDb()
    const tx = db.transaction(PROGRESSION_STORE, "readwrite")
    await Promise.all(progressions.map((p) => tx.store.put(p)))
    await tx.done
    progressions.forEach((p) => void pushProgression(p))
  },

  async delete(id: string): Promise<void> {
    const db = await getDb()
    await db.delete(PROGRESSION_STORE, id)
    const tombstone = await deletionRepository.record(id, "progression")
    void deleteProgressionRemote(tombstone)
  },

  /** リモートの内容でローカルを完全に置き換える(他端末からのログイン直後に使用) */
  async replaceAll(progressions: SavedProgression[]): Promise<void> {
    const db = await getDb()
    const tx = db.transaction(PROGRESSION_STORE, "readwrite")
    await tx.store.clear()
    await Promise.all(progressions.map((p) => tx.store.put(p)))
    await tx.done
  },
}

export const folderRepository = {
  async list(): Promise<Folder[]> {
    const db = await getDb()
    const items = await db.getAll(FOLDER_STORE)
    return items.map(migrateFolder)
  },

  async save(folder: Folder): Promise<void> {
    const db = await getDb()
    await db.put(FOLDER_STORE, folder)
    void pushFolder(folder)
  },

  async delete(id: string): Promise<void> {
    const db = await getDb()
    await db.delete(FOLDER_STORE, id)
    const tombstone = await deletionRepository.record(id, "folder")
    void deleteFolderRemote(tombstone)
  },

  /** リモートの内容でローカルを完全に置き換える(他端末からのログイン直後に使用) */
  async replaceAll(folders: Folder[]): Promise<void> {
    const db = await getDb()
    const tx = db.transaction(FOLDER_STORE, "readwrite")
    await tx.store.clear()
    await Promise.all(folders.map((f) => tx.store.put(f)))
    await tx.done
  },
}
