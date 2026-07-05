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

export const PROGRESSION_SCHEMA_VERSION = 2

/** 保存された進行(メモ4欄 + 所属フォルダ) */
export interface SavedProgression extends GeneratedProgression {
  schemaVersion: number
  memo: string
  songIdea: string
  arrangementNote: string
  logicProNote: string
  savedAt: string
  /** 所属フォルダ(曲)のid。null は未分類 */
  folderId: string | null
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
  }
}

export function migrateSavedProgression(raw: SavedProgression): SavedProgression {
  if (raw.schemaVersion === PROGRESSION_SCHEMA_VERSION) return raw
  return {
    ...raw,
    memo: raw.memo ?? "",
    songIdea: raw.songIdea ?? "",
    arrangementNote: raw.arrangementNote ?? "",
    logicProNote: raw.logicProNote ?? "",
    savedAt: raw.savedAt ?? raw.createdAt,
    // v1 → v2: フォルダ概念の導入。既存データは未分類にする
    folderId: raw.folderId ?? null,
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
  }
}
