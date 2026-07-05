import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import type { SavedProgression } from "@/types/progression"

const DB_NAME = "composer-os-chord-generator"
const DB_VERSION = 1

export const PROGRESSION_STORE = "progressions"

interface ChordGeneratorDB extends DBSchema {
  progressions: {
    key: string
    value: SavedProgression
    indexes: { "by-savedAt": string }
  }
}

let dbPromise: Promise<IDBPDatabase<ChordGeneratorDB>> | null = null

export function getDb(): Promise<IDBPDatabase<ChordGeneratorDB>> {
  dbPromise ??= openDB<ChordGeneratorDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore(PROGRESSION_STORE, { keyPath: "id" })
        store.createIndex("by-savedAt", "savedAt")
      }
    },
  })
  return dbPromise
}
