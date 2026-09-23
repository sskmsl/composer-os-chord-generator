import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import type { SavedProgression } from "@/types/progression"
import type { Folder } from "@/types/folder"
import type { FeedbackRecord } from "@/features/preference/preferenceModel"

const DB_NAME = "composer-os-chord-generator"
const DB_VERSION = 3

export const PROGRESSION_STORE = "progressions"
export const FOLDER_STORE = "folders"
/** 表示した候補と保存の記録(好みの学習用)。この端末だけに置き、同期しない */
export const FEEDBACK_STORE = "feedback"

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
  feedback: {
    key: string
    value: FeedbackRecord
    indexes: { "by-at": string }
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
      if (oldVersion < 3) {
        const store = db.createObjectStore(FEEDBACK_STORE, { keyPath: "id" })
        store.createIndex("by-at", "at")
      }
    },
  })
  return dbPromise
}
