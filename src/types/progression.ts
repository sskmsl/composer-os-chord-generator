import type { Mode, MoodId, SectionId, StyleId } from "./music"

export interface Scores {
  mylene: number
  boutonnat: number
  melancholy: number
  darkness: number
  cinematic: number
}

/** chord-engine が生成する進行(CHORD_ENGINE_SPEC 準拠) */
export interface GeneratedProgression {
  id: string
  chords: string[]
  key: string
  mode: Mode
  style: StyleId
  section: SectionId
  mood: MoodId
  romanNumerals: string[]
  bassMovement: string
  description: string
  scores: Scores
  createdAt: string
}

export const PROGRESSION_SCHEMA_VERSION = 3

/** 保存された進行(メモ4欄 + 所属フォルダ + 曲構成情報) */
export interface SavedProgression extends GeneratedProgression {
  schemaVersion: number
  memo: string
  songIdea: string
  arrangementNote: string
  logicProNote: string
  savedAt: string
  /** 所属フォルダ(曲)のid。null は未分類 */
  folderId: string | null
  /** フォルダ内での並び順(小さいほど先)。保存時刻由来の数値で初期化 */
  order: number
  /** 曲構成での繰り返し回数(このセクションを何回鳴らすか) */
  repeatCount: number
}

export function toSavedProgression(
  generated: GeneratedProgression,
  folderId: string | null,
): SavedProgression {
  return {
    ...generated,
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    memo: "",
    songIdea: "",
    arrangementNote: "",
    logicProNote: "",
    savedAt: new Date().toISOString(),
    folderId,
    order: Date.now(),
    repeatCount: 1,
  }
}

export function migrateSavedProgression(raw: SavedProgression): SavedProgression {
  if (raw.schemaVersion === PROGRESSION_SCHEMA_VERSION) return raw
  const savedAt = raw.savedAt ?? raw.createdAt
  return {
    ...raw,
    memo: raw.memo ?? "",
    songIdea: raw.songIdea ?? "",
    arrangementNote: raw.arrangementNote ?? "",
    logicProNote: raw.logicProNote ?? "",
    savedAt,
    // v1 → v2: フォルダ概念。既存データは未分類
    folderId: raw.folderId ?? null,
    // v2 → v3: 曲構成情報。並び順は保存時刻、繰り返しは1回で初期化
    order: raw.order ?? (Date.parse(savedAt) || 0),
    repeatCount: raw.repeatCount ?? 1,
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
  }
}
