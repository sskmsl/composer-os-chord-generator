import type { SavedProgression } from "@/types/progression"
import { migrateSavedProgression } from "@/types/progression"
import { getDb, PROGRESSION_STORE } from "./db"

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

  async delete(id: string): Promise<void> {
    const db = await getDb()
    await db.delete(PROGRESSION_STORE, id)
  },
}
