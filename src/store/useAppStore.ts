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
 * 取り消し(元に戻す)1回分。戻すときは「その操作で変わった項目だけ」を操作前の値へ戻し、
 * 今の時刻で保存し直す(同期でも戻した状態が新しい方として残る)。進行やフォルダを
 * 丸ごと書き戻さないので、後から行った別の編集(例: 自動保存したメモ)を巻き戻さない。
 */
interface UndoEntry {
  label: string
  /** 変わった項目の操作前の値(進行ごと) */
  progressionPatches: { id: string; before: Partial<SavedProgression> }[]
  /** 削除した進行(丸ごと戻す) */
  deletedProgressions: SavedProgression[]
  /** この操作で作った進行(戻すときは削除する) */
  createdProgressionIds: string[]
  folderPatches: { id: string; before: Partial<Folder> }[]
  deletedFolders: Folder[]
}

export interface UndoHistoryItem {
  token: string
  label: string
  /** 操作した時刻(ISO) */
  at: string
}

/** 取り消しの記録本体。履歴の表示(undoHistory)とは別に、store の外に持つ */
const undoEntries = new Map<string, UndoEntry>()
const UNDO_LIMIT = 30

function pick<T extends object>(source: T, keys: readonly (keyof T)[]): Partial<T> {
  const picked: Partial<T> = {}
  for (const key of keys) picked[key] = source[key]
  return picked
}

const FIELD_LABELS: Partial<Record<keyof SavedProgression, string>> = {
  chords: "コードを変更",
  key: "移調",
  folderId: "フォルダを移動",
  repeatCount: "繰り返し回数を変更",
  memo: "メモを編集",
  songIdea: "メモを編集",
  arrangementNote: "メモを編集",
  logicProNote: "メモを編集",
  order: "セクションを並べ替え",
}

/** 変えた項目から操作履歴の名前を決める(例: "コードを変更(Am – F – …)") */
function labelForPatch(keys: readonly (keyof SavedProgression)[], existing: SavedProgression): string {
  const name = keys.map((key) => FIELD_LABELS[key]).find(Boolean) ?? "進行を編集"
  const chords = existing.chords.join(" – ")
  return `${name}(${chords.length > 28 ? `${chords.slice(0, 28)}…` : chords})`
}

function emptyEntry(label: string): UndoEntry {
  return { label, progressionPatches: [], deletedProgressions: [], createdProgressionIds: [], folderPatches: [], deletedFolders: [] }
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
  /**
   * 戻り値は取り消し用のトークン(undo に渡すと、この変更の直前の状態へ戻す)。
   * label は操作履歴に出す名前(省略時は変えた項目から決める)
   */
  updateSaved(id: string, patch: Partial<SavedProgression>, label?: string): Promise<string>
  deleteSaved(id: string): Promise<string>
  /** トークンの操作を取り消す。取り消せなければ false(古すぎて記録が残っていない等) */
  undo(token: string): Promise<boolean>
  /** 最後の操作を取り消す。戻した操作の名前を返す(何もなければ null) */
  undoLatest(): Promise<string | null>
  /** 取り消せる操作の履歴(新しい順、最大30件) */
  undoHistory: UndoHistoryItem[]

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
  /** 記録を残して、戻り値の取り消し用トークンを返す(内部用) */
  recordUndo(entry: UndoEntry): string
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

  async updateSaved(id, patch, label) {
    const existing = get().saved.find((p) => p.id === id)
    if (!existing) throw new Error("進行が見つかりません")
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() }
    await progressionRepository.save(updated)
    set({ saved: get().saved.map((p) => (p.id === id ? updated : p)) })
    const keys = Object.keys(patch) as (keyof SavedProgression)[]
    return get().recordUndo({
      ...emptyEntry(label ?? labelForPatch(keys, existing)),
      progressionPatches: [{ id, before: pick(existing, keys) }],
    })
  },

  async deleteSaved(id) {
    const existing = get().saved.find((p) => p.id === id)
    await progressionRepository.delete(id)
    set({ saved: get().saved.filter((p) => p.id !== id) })
    return get().recordUndo({
      ...emptyEntry(`進行を削除(${existing?.chords.join(" – ") ?? ""})`),
      deletedProgressions: existing ? [existing] : [],
    })
  },

  undoHistory: [],

  recordUndo(entry) {
    const token = crypto.randomUUID()
    undoEntries.set(token, entry)
    const history = [{ token, label: entry.label, at: new Date().toISOString() }, ...get().undoHistory]
    for (const dropped of history.slice(UNDO_LIMIT)) undoEntries.delete(dropped.token)
    set({ undoHistory: history.slice(0, UNDO_LIMIT) })
    return token
  },

  async undoLatest() {
    const latest = get().undoHistory[0]
    if (!latest) return null
    return (await get().undo(latest.token)) ? latest.label : null
  },

  async undo(token) {
    const entry = undoEntries.get(token)
    if (!entry) return false
    undoEntries.delete(token)
    set({ undoHistory: get().undoHistory.filter((item) => item.token !== token) })
    const now = new Date().toISOString()

    // 1. 削除したものを丸ごと戻す(削除の記録も消す)
    const restoredFolders = entry.deletedFolders.map((f) => ({ ...f, updatedAt: now }))
    const restoredProgressions = entry.deletedProgressions.map((p) => ({ ...p, updatedAt: now }))
    // 2. 変わった項目だけを操作前の値へ戻す(その後に消されたものは戻さない)
    const folderById = new Map(get().folders.map((f) => [f.id, f]))
    const patchedFolders = entry.folderPatches.flatMap(({ id, before }) => {
      const current = folderById.get(id)
      return current ? [{ ...current, ...before, updatedAt: now }] : []
    })
    const progressionById = new Map(get().saved.map((p) => [p.id, p]))
    const patchedProgressions = entry.progressionPatches.flatMap(({ id, before }) => {
      const current = progressionById.get(id)
      return current ? [{ ...current, ...before, updatedAt: now }] : []
    })

    const folders = [...restoredFolders, ...patchedFolders]
    const progressions = [...restoredProgressions, ...patchedProgressions]
    await Promise.all(folders.map((f) => folderRepository.save(f)))
    if (progressions.length > 0) await progressionRepository.saveMany(progressions)
    const restoredIds = [...restoredFolders.map((f) => f.id), ...restoredProgressions.map((p) => p.id)]
    if (restoredIds.length > 0) {
      await deletionRepository.clear(restoredIds)
      void clearRemoteDeletions(restoredIds)
    }
    // 3. この操作で作ったもの(複製したセクション等)を消す
    const created = new Set(entry.createdProgressionIds.filter((id) => progressionById.has(id)))
    await Promise.all([...created].map((id) => progressionRepository.delete(id)))

    const folderIds = new Set(folders.map((f) => f.id))
    const progressionIds = new Set(progressions.map((p) => p.id))
    set({
      folders: [...get().folders.filter((f) => !folderIds.has(f.id)), ...folders].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
      saved: [...get().saved.filter((p) => !progressionIds.has(p.id) && !created.has(p.id)), ...progressions].sort(
        (a, b) => b.savedAt.localeCompare(a.savedAt),
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
    get().recordUndo({ ...emptyEntry(`フォルダ名を変更(${folder.name} → ${trimmed})`), folderPatches: [{ id, before: { name: folder.name } }] })
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
    return get().recordUndo({
      ...emptyEntry(`フォルダを削除(${folder?.name ?? ""})`),
      deletedFolders: folder ? [folder] : [],
      progressionPatches: affected.map((p) => ({ id: p.id, before: { folderId: p.folderId } })),
    })
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
    get().recordUndo({
      ...emptyEntry(`曲のテンポを変更(${folder.name})`),
      folderPatches: [{ id, before: { tempo: folder.tempo } }],
    })
  },

  async setFolderMemo(id, memo) {
    const folder = get().folders.find((f) => f.id === id)
    if (!folder) throw new Error("フォルダが見つかりません")
    const updated = { ...folder, memo, updatedAt: new Date().toISOString() }
    await folderRepository.save(updated)
    set({ folders: get().folders.map((f) => (f.id === id ? updated : f)) })
    get().recordUndo({
      ...emptyEntry(`曲のメモを編集(${folder.name})`),
      folderPatches: [{ id, before: { memo: folder.memo } }],
    })
  },

  async setRepeatCount(progressionId, count) {
    await get().updateSaved(progressionId, { repeatCount: Math.max(1, Math.round(count)) }, "繰り返し回数を変更")
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
    get().recordUndo({
      ...emptyEntry("セクションを並べ替え"),
      progressionPatches: [
        { id: target.id, before: { order: target.order } },
        { id: other.id, before: { order: other.order } },
      ],
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
    get().recordUndo({ ...emptyEntry("セクションを複製"), createdProgressionIds: [copy.id] })
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
