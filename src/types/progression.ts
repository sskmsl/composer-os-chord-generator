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

export const PROGRESSION_SCHEMA_VERSION = 1

/** 保存された進行(Detail画面の4メモ欄を追加) */
export interface SavedProgression extends GeneratedProgression {
  schemaVersion: number
  memo: string
  songIdea: string
  arrangementNote: string
  logicProNote: string
  savedAt: string
}

export function toSavedProgression(generated: GeneratedProgression): SavedProgression {
  return {
    ...generated,
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    memo: "",
    songIdea: "",
    arrangementNote: "",
    logicProNote: "",
    savedAt: new Date().toISOString(),
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
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
  }
}
