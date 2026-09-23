import type { FeedbackRecord } from "@/features/preference/preferenceModel"
import type { GeneratedProgression } from "@/types/progression"
import { FEEDBACK_STORE, getDb } from "./db"

/** 保持する記録の上限。古いものから消す */
const MAX_RECORDS = 5000

/**
 * 好みの学習用の記録(表示した候補と、そのうち保存されたもの)。
 * 記録に失敗しても生成・保存の本来の操作は止めない(ベストエフォート)。
 */
export const feedbackRepository = {
  async list(): Promise<FeedbackRecord[]> {
    try {
      const db = await getDb()
      return await db.getAll(FEEDBACK_STORE)
    } catch {
      return []
    }
  },

  async recordShown(results: readonly GeneratedProgression[]): Promise<void> {
    try {
      const db = await getDb()
      const tx = db.transaction(FEEDBACK_STORE, "readwrite")
      await Promise.all(
        results.map((p) =>
          tx.store.put({
            id: p.id,
            at: p.createdAt,
            style: p.style,
            mode: p.mode,
            tags: p.featureTags ?? [],
            saved: false,
          }),
        ),
      )
      await tx.done
      await pruneOldRecords()
    } catch {
      // 記録は補助機能。失敗しても無視する
    }
  },

  async markSaved(progression: GeneratedProgression): Promise<void> {
    try {
      const db = await getDb()
      const existing = await db.get(FEEDBACK_STORE, progression.id)
      await db.put(FEEDBACK_STORE, {
        id: progression.id,
        at: existing?.at ?? progression.createdAt,
        style: progression.style,
        mode: progression.mode,
        tags: existing?.tags.length ? existing.tags : (progression.featureTags ?? []),
        saved: true,
      })
    } catch {
      // 記録は補助機能。失敗しても無視する
    }
  },
}

async function pruneOldRecords(): Promise<void> {
  const db = await getDb()
  const count = await db.count(FEEDBACK_STORE)
  if (count <= MAX_RECORDS) return
  const tx = db.transaction(FEEDBACK_STORE, "readwrite")
  let toDelete = count - MAX_RECORDS
  let cursor = await tx.store.index("by-at").openCursor()
  while (cursor && toDelete > 0) {
    await cursor.delete()
    toDelete--
    cursor = await cursor.continue()
  }
  await tx.done
}
