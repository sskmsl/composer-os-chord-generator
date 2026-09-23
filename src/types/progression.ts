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
   * 長く持たせるなど、和声のリズムに緩急を作る。試聴・MIDI書き出しに加え、
   * Composer OS内の他アプリとの受け渡し形式(exchange/composerSongExchange.ts、
   * version 2)の startBeat / durationBeats にもそのまま反映される。
   */
  beats: number[]
}

export const PROGRESSION_SCHEMA_VERSION = 5

/**
 * コードの長さ(拍)を小節単位(4拍の倍数)にそろえる。
 * 2拍のコードは、隣のコードと2拍ずつで1小節を分け合う形にする
 * (例: C(2)–G/B(2) | Am(4))。相手がいなければ4拍に戻す。
 * これでどのコードも小節頭か小節の3拍目から始まり、セクションの合計も
 * 4拍の倍数になる。Composer Arrangerへの受け渡しやMIDI書き出しで、
 * 次のセクションが小節の途中から始まるのを防ぐ。
 */
export function alignBeatsToBars(beats: number[]): number[] {
  const result = [...beats]
  const paired = new Set<number>()
  const last = result.length - 1
  for (let i = 0; i < result.length; i++) {
    if (result[i] !== 2 || paired.has(i)) continue
    if (i < last && result[i + 1] === 2 && !paired.has(i + 1)) {
      // 2拍が連続していれば、その2つで1小節
      paired.add(i).add(i + 1)
    } else if (i > 0 && result[i - 1] === 4 && !paired.has(i - 1)) {
      // 直前のコードと1小節を分け合う(経過和音が前の和音から流れ込む形)
      result[i - 1] = 2
      paired.add(i - 1).add(i)
    } else if (i + 1 < last && result[i + 1] === 4 && !paired.has(i + 1)) {
      // 直後のコードと分け合う(着地の和音=末尾は短くしない)
      result[i + 1] = 2
      paired.add(i).add(i + 1)
    } else {
      result[i] = 4
    }
  }
  // 想定外の長さ(2/4/8以外)が混ざっていても、合計だけは必ず小節単位にする
  const remainder = result.reduce((a, b) => a + b, 0) % 4
  if (remainder !== 0 && result.length > 0) result[last] += 4 - remainder
  return result
}

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
    // 小節の途中で終わる長さの組み合わせ(和声のリズム導入直後のデータ)も小節単位へそろえる
    beats: alignBeatsToBars(raw.beats ?? raw.chords.map(() => 4)),
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
  }
}
