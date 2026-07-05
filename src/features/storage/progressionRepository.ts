import type { SavedProgression } from "@/types/progression"
import { migrateSavedProgression } from "@/types/progression"
import type { Folder } from "@/types/folder"
import { FOLDER_STORE, getDb, PROGRESSION_STORE } from "./db"

/** 進行の永続化。将来のクラウド同期は同シグネチャの別実装で置き換える */
export const progressionRepository = {
  async list(): Promise<SavedProgression[]> {
    const db = await getDb()
    const items = await db.getAll(PROGRESSION_STORE)
    return items.map(migrateSavedProgression)
  },

  async save(progression: SavedProgression): Promise<void> {
    const db = await getDb()
    await db.put(PROGRESSION_STORE, progression)
  },

  async saveMany(progressions: SavedProgression[]): Promise<void> {
    const db = await getDb()
    const tx = db.transaction(PROGRESSION_STORE, "readwrite")
    await Promise.all(progressions.map((p) => tx.store.put(p)))
    await tx.done
  },

  async delete(id: string): Promise<void> {
    const db = await getDb()
    await db.delete(PROGRESSION_STORE, id)
  },
}

export const folderRepository = {
  async list(): Promise<Folder[]> {
    const db = await getDb()
    return db.getAll(FOLDER_STORE)
  },

  async save(folder: Folder): Promise<void> {
    const db = await getDb()
    await db.put(FOLDER_STORE, folder)
  },

  async delete(id: string): Promise<void> {
    const db = await getDb()
    await db.delete(FOLDER_STORE, id)
  },
}
