import { create } from "zustand"
import { generateProgressions, type GenerateParams } from "@/features/chord-engine/generateProgressions"
import { folderRepository, progressionRepository } from "@/features/storage/progressionRepository"
import type { Folder } from "@/types/folder"
import { createFolder as buildFolder } from "@/types/folder"
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

  // フォルダ(曲)
  folders: Folder[]
  /** Generatorで保存するときの保存先フォルダ(null=未分類) */
  saveTargetFolderId: string | null
  setSaveTargetFolder(id: string | null): void
  createFolder(name: string): Promise<Folder>
  renameFolder(id: string, name: string): Promise<void>
  deleteFolder(id: string): Promise<void>
  moveToFolder(progressionId: string, folderId: string | null): Promise<void>
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
      const [saved, folders] = await Promise.all([
        progressionRepository.list(),
        folderRepository.list(),
      ])
      saved.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      folders.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      set({ saved, folders, loaded: true, error: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "読み込みに失敗しました", loaded: true })
    }
  },

  async saveProgression(generated) {
    const entry = toSavedProgression(generated, get().saveTargetFolderId)
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

  folders: [],
  saveTargetFolderId: null,

  setSaveTargetFolder(id) {
    set({ saveTargetFolderId: id })
  },

  async createFolder(name) {
    const trimmed = name.trim()
    if (trimmed === "") throw new Error("フォルダ名を入力してください")
    if (get().folders.some((f) => f.name === trimmed)) {
      throw new Error("同名のフォルダがあります")
    }
    const folder = buildFolder(trimmed)
    await folderRepository.save(folder)
    set({ folders: [...get().folders, folder] })
    return folder
  },

  async renameFolder(id, name) {
    const trimmed = name.trim()
    if (trimmed === "") throw new Error("フォルダ名を入力してください")
    const folder = get().folders.find((f) => f.id === id)
    if (!folder) throw new Error("フォルダが見つかりません")
    const updated = { ...folder, name: trimmed }
    await folderRepository.save(updated)
    set({ folders: get().folders.map((f) => (f.id === id ? updated : f)) })
  },

  async deleteFolder(id) {
    // フォルダ内の進行は削除せず未分類へ移す
    const affected = get().saved.filter((p) => p.folderId === id)
    const moved = affected.map((p) => ({ ...p, folderId: null }))
    await progressionRepository.saveMany(moved)
    await folderRepository.delete(id)
    const movedIds = new Set(moved.map((p) => p.id))
    set({
      folders: get().folders.filter((f) => f.id !== id),
      saved: get().saved.map((p) => (movedIds.has(p.id) ? { ...p, folderId: null } : p)),
      saveTargetFolderId: get().saveTargetFolderId === id ? null : get().saveTargetFolderId,
    })
  },

  async moveToFolder(progressionId, folderId) {
    await get().updateSaved(progressionId, { folderId })
  },
}))
