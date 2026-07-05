import { create } from "zustand"
import { generateProgressions, type GenerateParams } from "@/features/chord-engine/generateProgressions"
import { progressionRepository } from "@/features/storage/progressionRepository"
import type { MoodId, MusicKey, SectionId, StyleId, VariationCount } from "@/types/music"
import type { GeneratedProgression, SavedProgression } from "@/types/progression"
import { toSavedProgression } from "@/types/progression"

interface GeneratorParams {
  key: MusicKey
  style: StyleId
  section: SectionId
  mood: MoodId
  count: VariationCount
}

interface AppStore {
  // ジェネレーター
  params: GeneratorParams
  results: GeneratedProgression[]
  /** 「前の結果に戻る」用の1世代分の履歴 */
  previousResults: GeneratedProgression[] | null
  setParams(partial: Partial<GeneratorParams>): void
  generate(): void
  restorePrevious(): void

  // 保存済み
  saved: SavedProgression[]
  loaded: boolean
  error: string | null
  load(): Promise<void>
  saveProgression(generated: GeneratedProgression): Promise<void>
  updateSaved(id: string, patch: Partial<SavedProgression>): Promise<void>
  deleteSaved(id: string): Promise<void>
}

export const useAppStore = create<AppStore>((set, get) => ({
  params: {
    key: { tonic: "A", mode: "minor" },
    style: "romanticDark",
    section: "chorus",
    mood: "melancholic",
    count: 5,
  },
  results: [],
  previousResults: null,

  setParams(partial) {
    set({ params: { ...get().params, ...partial } })
  },

  generate() {
    const { params, results } = get()
    const generateParams: GenerateParams = { ...params }
    set({
      previousResults: results.length > 0 ? results : get().previousResults,
      results: generateProgressions(generateParams),
    })
  },

  restorePrevious() {
    const { previousResults, results } = get()
    if (!previousResults) return
    set({ results: previousResults, previousResults: results })
  },

  saved: [],
  loaded: false,
  error: null,

  async load() {
    try {
      const saved = await progressionRepository.list()
      saved.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      set({ saved, loaded: true, error: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "読み込みに失敗しました", loaded: true })
    }
  },

  async saveProgression(generated) {
    const entry = toSavedProgression(generated)
    await progressionRepository.save(entry)
    set({ saved: [entry, ...get().saved] })
  },

  async updateSaved(id, patch) {
    const existing = get().saved.find((p) => p.id === id)
    if (!existing) throw new Error("進行が見つかりません")
    const updated = { ...existing, ...patch }
    await progressionRepository.save(updated)
    set({ saved: get().saved.map((p) => (p.id === id ? updated : p)) })
  },

  async deleteSaved(id) {
    await progressionRepository.delete(id)
    set({ saved: get().saved.filter((p) => p.id !== id) })
  },
}))
