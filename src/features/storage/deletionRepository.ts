import { DELETION_STORE, getDb, type DeletionRecord } from "./db"

/** 削除の記録をこの期間だけ残す。全端末が一度は同期している想定の長さ */
export const DELETION_RETENTION_DAYS = 90

/** この端末で削除した進行・フォルダの記録(tombstone)。同期時にクラウドの記録と合わせて使う */
export const deletionRepository = {
  async list(): Promise<DeletionRecord[]> {
    try {
      const db = await getDb()
      return await db.getAll(DELETION_STORE)
    } catch {
      return []
    }
  },

  async record(id: string, kind: DeletionRecord["kind"], deletedAt = new Date().toISOString()): Promise<DeletionRecord> {
    const entry: DeletionRecord = { id, kind, deletedAt }
    try {
      const db = await getDb()
      await db.put(DELETION_STORE, entry)
    } catch {
      // 記録に失敗しても削除そのものは止めない
    }
    return entry
  },

  /** 保存し直した・バックアップから復元した項目の削除記録を消す */
  async clear(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return
    try {
      const db = await getDb()
      const tx = db.transaction(DELETION_STORE, "readwrite")
      await Promise.all(ids.map((id) => tx.store.delete(id)))
      await tx.done
    } catch {
      // 無視
    }
  },

  async replaceAll(records: readonly DeletionRecord[]): Promise<void> {
    try {
      const db = await getDb()
      const tx = db.transaction(DELETION_STORE, "readwrite")
      await tx.store.clear()
      await Promise.all(records.map((r) => tx.store.put(r)))
      await tx.done
    } catch {
      // 無視
    }
  },
}
