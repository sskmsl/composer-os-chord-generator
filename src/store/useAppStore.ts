import { create } from "zustand"
import { generateProgressions, rootSkeletonOf, type GenerateParams } from "@/features/chord-engine/generateProgressions"
import { downloadComposerSongExchange } from "@/features/exchange/composerSongExchange"
import { downloadSongSmf } from "@/features/midi/exportSong"
import { downloadBackup, parseBackup } from "@/features/storage/backup"
import { feedbackRepository } from "@/features/storage/feedbackRepository"
import { learnPreference, type PreferenceModel } from "@/features/preference/preferenceModel"
import { folderRepository, progressionRepository } from "@/features/storage/progressionRepository"
import { clearRemoteDeletions, pushFolder, pushProgression } from "@/features/sync/supabaseSync"
import { deletionRepository } from "@/features/storage/deletionRepository"
import type { Folder } from "@/types/folder"
import { createFolder as buildFolder } from "@/types/folder"
import type { ChordCount, MoodId, MusicKey, SectionId, StyleId, VariationCount } from "@/types/music"
import type { GeneratedProgression, SavedProgression } from "@/types/progression"
import { toSavedProgression } from "@/types/progression"

/**
 * 取り消し(元に戻す)1回分。操作の直前の状態を持ち、戻すときはその状態を
 * 「今の時刻で保存し直す」形で書き戻す(同期でも新しい方=戻した状態が残る)。
 */
interface UndoEntry {
  /** 操作前の状態に戻す進行(削除した進行もここに入る) */
  progressions: SavedProgression[]
  /** 操作前の状態に戻すフォルダ(削除したフォルダもここに入る) */
  folders: Folder[]
}

/** 取り消しの記録。画面の再描画に関わらないので store の state には置かない */
const undoEntries = new Map<string, UndoEntry>()
const UNDO_LIMIT = 30

function recordUndo(entry: UndoEntry): string {
  const token = crypto.randomUUID()
  undoEntries.set(token, entry)
  // 古いものから捨てる(Mapは挿入順)
  while (undoEntries.size > UNDO_LIMIT) undoEntries.delete(undoEntries.keys().next().value as string)
  return token
}

interface GeneratorParams {
  key: MusicKey
  style: StyleId
  section: SectionId
  mood: MoodId
  count: VariationCount
  length: ChordCount
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
  /** 戻り値は取り消し用のトークン(undo に渡すと、この変更の直前の状態へ戻す) */
  updateSaved(id: string, patch: Partial<SavedProgression>): Promise<string>
  deleteSaved(id: string): Promise<string>
  /** トークンの操作を取り消す。取り消せなければ false(古すぎて記録が残っていない等) */
  undo(token: string): Promise<boolean>

  // 好みの学習(表示した候補と保存の記録から、順位の補正に使う)
  /** 保存数が MIN_SAVES_FOR_PREFERENCE 未満の間は null */
  preference: PreferenceModel | null
  /** 学習に使える保存の記録数(画面で「あと何件で反映」を示す) */
  feedbackSavedCount: number
  refreshPreference(): Promise<void>

  // フォルダ(曲)
  folders: Folder[]
  /** Generatorで保存するときの保存先フォルダ(null=未分類) */
  saveTargetFolderId: string | null
  setSaveTargetFolder(id: string | null): void
  createFolder(name: string): Promise<Folder>
  renameFolder(id: string, name: string): Promise<void>
  deleteFolder(id: string): Promise<string>
  moveToFolder(progressionId: string, folderId: string | null): Promise<string>

  // 曲構成(フォルダ = 1曲)
  setFolderTempo(id: string, tempo: number | undefined): Promise<void>
  setFolderMemo(id: string, memo: string): Promise<void>
  setRepeatCount(progressionId: string, count: number): Promise<void>
  reorderSection(progressionId: string, direction: "up" | "down"): Promise<void>
  duplicateSection(progressionId: string): Promise<SavedProgression>
  exportFolderAsMidi(folderId: string): void
  exportFolderForArranger(folderId: string): void

  // バックアップ(同期に依存しない、手元で確保する保険)
  exportAllAsBackup(): void
  restoreFromBackup(text: string): Promise<void>
}

export const useAppStore = create<AppStore>((set, get) => ({
  params: {
    key: { tonic: "A", mode: "minor" },
    style: "romanticDark",
    section: "chorus",
    mood: "melancholic",
    count: 5,
    length: 4,
  },
  results: [],
  previousResults: null,

  setParams(partial) {
    set({ params: { ...get().params, ...partial } })
  },

  generate() {
    const { params, results, saved, preference } = get()
    // 曲集(保存済み)で同じスタイル・調に使った骨格を渡し、数百曲作っても同じ型に偏らないようにする
    const usedSkeletons = new Set(
      saved
        .filter((p) => p.style === params.style && p.mode === params.key.mode)
        .map((p) => rootSkeletonOf(p.romanNumerals)),
    )
    const generateParams: GenerateParams = { ...params, usedSkeletons, preference }
    const generated = generateProgressions(generateParams)
    set({
      previousResults: results.length > 0 ? results : get().previousResults,
      results: generated,
    })
    void feedbackRepository.recordShown(generated)
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
      void get().refreshPreference()
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "読み込みに失敗しました", loaded: true })
    }
  },

  async saveProgression(generated) {
    if (get().saved.some((p) => p.id === generated.id)) return

    const entry = toSavedProgression(generated, get().saveTargetFolderId)
    await progressionRepository.save(entry)
    set((state) => ({
      saved: state.saved.some((p) => p.id === entry.id) ? state.saved : [entry, ...state.saved],
    }))
    await feedbackRepository.markSaved(generated)
    void get().refreshPreference()
  },

  preference: null,
  feedbackSavedCount: 0,

  async refreshPreference() {
    const records = await feedbackRepository.list()
    set({
      preference: learnPreference(records),
      feedbackSavedCount: records.filter((r) => r.saved).length,
    })
  },

  async updateSaved(id, patch) {
    const existing = get().saved.find((p) => p.id === id)
    if (!existing) throw new Error("進行が見つかりません")
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() }
    await progressionRepository.save(updated)
    set({ saved: get().saved.map((p) => (p.id === id ? updated : p)) })
    return recordUndo({ progressions: [existing], folders: [] })
  },

  async deleteSaved(id) {
    const existing = get().saved.find((p) => p.id === id)
    await progressionRepository.delete(id)
    set({ saved: get().saved.filter((p) => p.id !== id) })
    return recordUndo({ progressions: existing ? [existing] : [], folders: [] })
  },

  async undo(token) {
    const entry = undoEntries.get(token)
    if (!entry) return false
    undoEntries.delete(token)
    const now = new Date().toISOString()
    // 戻した状態を「今の編集」として保存し直す。削除した項目は削除の記録も消す
    // (記録より新しい保存なので同期でも残るが、記録自体も残さない)
    const folders = entry.folders.map((f) => ({ ...f, updatedAt: now }))
    const progressions = entry.progressions.map((p) => ({ ...p, updatedAt: now }))
    await Promise.all(folders.map((f) => folderRepository.save(f)))
    if (progressions.length > 0) await progressionRepository.saveMany(progressions)
    const ids = [...folders.map((f) => f.id), ...progressions.map((p) => p.id)]
    await deletionRepository.clear(ids)
    void clearRemoteDeletions(ids)

    const folderIds = new Set(folders.map((f) => f.id))
    const progressionIds = new Set(progressions.map((p) => p.id))
    set({
      folders: [...get().folders.filter((f) => !folderIds.has(f.id)), ...folders].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
      saved: [...get().saved.filter((p) => !progressionIds.has(p.id)), ...progressions].sort((a, b) =>
        b.savedAt.localeCompare(a.savedAt),
      ),
    })
    return true
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
    const updated = { ...folder, name: trimmed, updatedAt: new Date().toISOString() }
    await folderRepository.save(updated)
    set({ folders: get().folders.map((f) => (f.id === id ? updated : f)) })
  },

  async deleteFolder(id) {
    // フォルダ内の進行は削除せず未分類へ移す
    const folder = get().folders.find((f) => f.id === id)
    const affected = get().saved.filter((p) => p.folderId === id)
    const now = new Date().toISOString()
    const moved = affected.map((p) => ({ ...p, folderId: null, updatedAt: now }))
    await progressionRepository.saveMany(moved)
    await folderRepository.delete(id)
    const movedIds = new Set(moved.map((p) => p.id))
    set({
      folders: get().folders.filter((f) => f.id !== id),
      saved: get().saved.map((p) => (movedIds.has(p.id) ? { ...p, folderId: null, updatedAt: now } : p)),
      saveTargetFolderId: get().saveTargetFolderId === id ? null : get().saveTargetFolderId,
    })
    return recordUndo({ progressions: affected, folders: folder ? [folder] : [] })
  },

  async moveToFolder(progressionId, folderId) {
    return get().updateSaved(progressionId, { folderId })
  },

  async setFolderTempo(id, tempo) {
    const folder = get().folders.find((f) => f.id === id)
    if (!folder) throw new Error("フォルダが見つかりません")
    const updated = { ...folder, tempo, updatedAt: new Date().toISOString() }
    await folderRepository.save(updated)
    set({ folders: get().folders.map((f) => (f.id === id ? updated : f)) })
  },

  async setFolderMemo(id, memo) {
    const folder = get().folders.find((f) => f.id === id)
    if (!folder) throw new Error("フォルダが見つかりません")
    const updated = { ...folder, memo, updatedAt: new Date().toISOString() }
    await folderRepository.save(updated)
    set({ folders: get().folders.map((f) => (f.id === id ? updated : f)) })
  },

  async setRepeatCount(progressionId, count) {
    await get().updateSaved(progressionId, { repeatCount: Math.max(1, Math.round(count)) })
  },

  async reorderSection(progressionId, direction) {
    const target = get().saved.find((p) => p.id === progressionId)
    if (!target) return
    const siblings = get()
      .saved.filter((p) => p.folderId === target.folderId)
      .sort((a, b) => a.order - b.order)
    const idx = siblings.findIndex((p) => p.id === progressionId)
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const other = siblings[swapIdx]
    // order 値を入れ替える
    const now = new Date().toISOString()
    const a = { ...target, order: other.order, updatedAt: now }
    const b = { ...other, order: target.order, updatedAt: now }
    await progressionRepository.saveMany([a, b])
    set({
      saved: get().saved.map((p) => (p.id === a.id ? a : p.id === b.id ? b : p)),
    })
  },

  async duplicateSection(progressionId) {
    const target = get().saved.find((p) => p.id === progressionId)
    if (!target) throw new Error("進行が見つかりません")

    // 同じフォルダ内で、元のセクションの直後に挿入されるようorderを算出する
    const siblings = get()
      .saved.filter((p) => p.folderId === target.folderId)
      .sort((a, b) => a.order - b.order)
    const idx = siblings.findIndex((p) => p.id === progressionId)
    const next = siblings[idx + 1]
    const order = next ? (target.order + next.order) / 2 : target.order + 1

    const copy: SavedProgression = {
      ...target,
      id: crypto.randomUUID(),
      order,
      savedAt: new Date().toISOString(),
    }
    await progressionRepository.save(copy)
    set({ saved: [...get().saved, copy] })
    return copy
  },

  exportFolderAsMidi(folderId) {
    const folder = get().folders.find((f) => f.id === folderId)
    if (!folder) throw new Error("フォルダが見つかりません")
    downloadSongSmf(folder, get().saved)
  },

  exportFolderForArranger(folderId) {
    const folder = get().folders.find((f) => f.id === folderId)
    if (!folder) throw new Error("フォルダが見つかりません")
    downloadComposerSongExchange(folder, get().saved)
  },

  exportAllAsBackup() {
    downloadBackup(get().folders, get().saved)
  },

  async restoreFromBackup(text) {
    const { folders, progressions } = parseBackup(text)
    await folderRepository.replaceAll(folders)
    await progressionRepository.replaceAll(progressions)

    const sorted = {
      saved: [...progressions].sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
      folders: [...folders].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }
    set({ saved: sorted.saved, folders: sorted.folders })

    // 復元した項目は意図して戻したものなので、過去の削除の記録を解除する
    // (残っていると、次の同期で「削除済み」として再び消えてしまう)
    const restoredIds = [...folders.map((f) => f.id), ...progressions.map((p) => p.id)]
    await deletionRepository.clear(restoredIds)
    void clearRemoteDeletions(restoredIds)

    // replaceAllはローカルのみの更新なので、次回ログイン同期でリモートの古い状態に
    // 上書きされないよう、復元した内容をリモートへも反映しておく(ベストエフォート)
    void Promise.all([...folders.map(pushFolder), ...progressions.map(pushProgression)])
  },
}))
