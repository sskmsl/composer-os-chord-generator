import { normalizeSectionRole, normalizeStyleId, type Mode, type MoodId, type SectionId, type StyleId } from "./music"

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
  /**
   * 各コードの長さ(拍数、4/4の四分音符単位)。chords と同じ長さの配列。
   * 既定は4拍=1小節だが、経過的な転回(声部進行)は短く、終止の着地は
   * 長く持たせるなど、和声のリズムに緩急を作る。試聴とMIDI書き出しでのみ使用し、
   * Composer OS内の他アプリとの受け渡し形式(exchange/composerSongExchange.ts、
   * version 1)は「1コード=1小節」を明示した既存契約のため対象外とする。
   */
  beats: number[]
}

export const PROGRESSION_SCHEMA_VERSION = 5

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
  const savedAt = raw.savedAt ?? raw.createdAt
  return {
    ...raw,
    section: normalizeSectionRole(raw.section),
    // 廃止したスタイル(Symphonic Rock)で保存された進行を現行スタイルへ読み替える
    style: normalizeStyleId(raw.style),
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
    // v3 → v4: SectionIdをComposer Arrangerと共通のROLEへ正規化
    // v4 → v5: 和声のリズム(拍数)。既存データは全コード4拍(=旧仕様と同じ響き)で初期化
    beats: raw.beats ?? raw.chords.map(() => 4),
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
  }
}
