import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import type { SavedProgression } from "@/types/progression"
import type { Folder } from "@/types/folder"

const DB_NAME = "composer-os-chord-generator"
const DB_VERSION = 2

export const PROGRESSION_STORE = "progressions"
export const FOLDER_STORE = "folders"

interface ChordGeneratorDB extends DBSchema {
  progressions: {
    key: string
    value: SavedProgression
    indexes: { "by-savedAt": string }
  }
  folders: {
    key: string
    value: Folder
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
      if (oldVersion < 2) {
        db.createObjectStore(FOLDER_STORE, { keyPath: "id" })
      }
    },
  })
  return dbPromise
}
