import type { MusicKey } from "@/types/music"

/**
 * ディグリー記号(例: "i(add9)", "bVImaj7/i", "V7sus4", "#ivdim", "IIø")を
 * 構造体として解析し、キーに応じた実コード名へ変換する。
 */
export interface ParsedChord {
  /** 元のディグリー表記(ローマ数字表示にそのまま使う) */
  token: string
  /** 変化記号: b=-1, #=+1, なし=0 */
  acc: number
  /** ローマ数字(大文字化した形。I〜VII) */
  roman: string
  /** 小文字表記(=マイナー系)か */
  lower: boolean
  /** 品質サフィックス: "", "add9", "maj7", "m9", "m11", "11", "7", "sus2", "sus4", "7sus4", "dim", "ø", "6" */
  suffix: string
  /** スラッシュベース(ディグリー)。raw は表示用の元表記 */
  bass?: { acc: number; roman: string; raw: string }
}

const ROMAN_SEMITONES: Record<string, number> = {
  I: 0,
  II: 2,
  III: 4,
  IV: 5,
  V: 7,
  VI: 9,
  VII: 11,
}

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

export const NOTE_TO_PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
}

/** フラット表記を使うキー(それ以外はシャープ表記) */
const FLAT_KEYS = new Set([
  "F-major", "Bb-major", "Eb-major", "Ab-major", "Db-major",
  "D-minor", "G-minor", "C-minor", "F-minor", "Bb-minor", "Eb-minor",
])

const TOKEN_RE = /^([b#]?)(i{1,3}|iv|v|vi{0,2}|I{1,3}|IV|V|VI{0,2})((?:maj7|add9|m9|m11|7sus4|sus2|sus4|dim|aug|11|7|6|ø)?)$/

export function parseToken(token: string): ParsedChord {
  const [main, bassPart] = token.replace(/[()]/g, "").split("/")
  const m = TOKEN_RE.exec(main)
  if (!m) throw new Error(`不正なディグリー記号: ${token}`)
  const [, accStr, romanRaw, suffix] = m
  const parsed: ParsedChord = {
    token,
    acc: accStr === "b" ? -1 : accStr === "#" ? 1 : 0,
    roman: romanRaw.toUpperCase(),
    lower: romanRaw === romanRaw.toLowerCase(),
    suffix,
  }
  if (bassPart) {
    const bm = /^([b#]?)(i{1,3}|iv|v|vi{0,2}|I{1,3}|IV|V|VI{0,2})$/.exec(bassPart)
    if (!bm) throw new Error(`不正なベース記号: ${token}`)
    parsed.bass = {
      acc: bm[1] === "b" ? -1 : bm[1] === "#" ? 1 : 0,
      roman: bm[2].toUpperCase(),
      raw: bassPart,
    }
  }
  return parsed
}

/** ParsedChord からディグリー表記文字列を再構築する(装飾後のローマ数字表示用) */
export function buildToken(parsed: ParsedChord): string {
  const acc = parsed.acc === -1 ? "b" : parsed.acc === 1 ? "#" : ""
  const roman = parsed.lower ? parsed.roman.toLowerCase() : parsed.roman
  const suffix =
    parsed.suffix === "add9" && parsed.lower ? "(add9)" : parsed.suffix === "ø" ? "ø" : parsed.suffix
  const bass = parsed.bass ? `/${parsed.bass.raw}` : ""
  return `${acc}${roman}${suffix}${bass}`
}

export function degreeSemitone(acc: number, roman: string): number {
  const base = ROMAN_SEMITONES[roman]
  if (base == null) throw new Error(`不正なローマ数字: ${roman}`)
  return (base + acc + 12) % 12
}

function noteName(pc: number, key: MusicKey): string {
  const useFlats = FLAT_KEYS.has(`${key.tonic}-${key.mode}`)
  return (useFlats ? FLAT_NAMES : SHARP_NAMES)[pc]
}

export function rootPc(parsed: ParsedChord, key: MusicKey): number {
  const tonicPc = NOTE_TO_PC[key.tonic]
  return (tonicPc + degreeSemitone(parsed.acc, parsed.roman)) % 12
}

export function bassPc(parsed: ParsedChord, key: MusicKey): number {
  if (!parsed.bass) return rootPc(parsed, key)
  const tonicPc = NOTE_TO_PC[key.tonic]
  return (tonicPc + degreeSemitone(parsed.bass.acc, parsed.bass.roman)) % 12
}

/** 実コード名を生成する(例: F#m(add9), Dmaj7/F#) */
export function chordName(parsed: ParsedChord, key: MusicKey): string {
  const root = noteName(rootPc(parsed, key), key)
  let quality: string
  switch (parsed.suffix) {
    case "dim":
      quality = "dim"
      break
    case "aug":
      quality = "aug"
      break
    case "ø":
      quality = "m7b5"
      break
    case "sus2":
    case "sus4":
      quality = parsed.suffix
      break
    case "7sus4":
      quality = "7sus4"
      break
    case "maj7":
      quality = parsed.lower ? "mMaj7" : "maj7"
      break
    case "add9":
      quality = parsed.lower ? "m(add9)" : "add9"
      break
    case "m9":
      quality = "m9"
      break
    case "m11":
      quality = "m11"
      break
    case "11":
      quality = parsed.lower ? "m11" : "11"
      break
    case "7":
      quality = parsed.lower ? "m7" : "7"
      break
    case "6":
      quality = parsed.lower ? "m6" : "6"
      break
    default:
      quality = parsed.lower ? "m" : ""
  }
  let name = root + quality
  if (parsed.bass) {
    name += "/" + noteName(bassPc(parsed, key), key)
  }
  return name
}

export function bassNoteName(parsed: ParsedChord, key: MusicKey): string {
  return noteName(bassPc(parsed, key), key)
}

/**
 * サフィックスからルート起点の構成音(半音インターバル)を返す。
 * chordName() の quality 判定と対になる、声部進行分析(共通音・半音進行)用の
 * 共有ユーティリティ。実際の再生用ボイシング(audio/chordSymbols.ts)とは
 * 独立しているが、和音の定義は一致させてある。
 */
export function chordIntervals(parsed: ParsedChord): number[] {
  const { suffix, lower } = parsed
  switch (suffix) {
    case "dim":
      return [0, 3, 6]
    case "ø":
      return [0, 3, 6, 10]
    case "aug":
      return [0, 4, 8]
    case "maj7":
      return lower ? [0, 3, 7, 11] : [0, 4, 7, 11]
    case "add9":
      return lower ? [0, 3, 7, 14] : [0, 4, 7, 14]
    case "m9":
      return [0, 3, 7, 10, 14]
    case "m11":
      return [0, 3, 7, 10, 14, 17]
    case "11":
      return lower ? [0, 3, 7, 10, 14, 17] : [0, 4, 7, 10, 14, 17]
    case "sus2":
      return [0, 2, 7]
    case "sus4":
      return [0, 5, 7]
    case "7sus4":
      return [0, 5, 7, 10]
    case "7":
      return lower ? [0, 3, 7, 10] : [0, 4, 7, 10]
    case "6":
      return lower ? [0, 3, 7, 9] : [0, 4, 7, 9]
    default:
      return lower ? [0, 3, 7] : [0, 4, 7]
  }
}

/** キーのトニックを基準にした、和音の構成音(スラッシュベース含む)のピッチクラス集合 */
export function chordPitchClasses(parsed: ParsedChord): number[] {
  const rootSemi = degreeSemitone(parsed.acc, parsed.roman)
  const pcs = new Set(chordIntervals(parsed).map((iv) => (rootSemi + iv) % 12))
  pcs.add(bassSemitoneOf(parsed))
  return [...pcs]
}

/** 響きの根拠となるベース音(スラッシュがあればそちら)のピッチクラス */
export function bassSemitoneOf(parsed: ParsedChord): number {
  return parsed.bass
    ? degreeSemitone(parsed.bass.acc, parsed.bass.roman)
    : degreeSemitone(parsed.acc, parsed.roman)
}

/** ベース以外の構成音(内声+上声)のピッチクラス集合。内声の半音進行判定に使う */
export function upperPitchClasses(parsed: ParsedChord): number[] {
  const bass = bassSemitoneOf(parsed)
  return chordPitchClasses(parsed).filter((pc) => pc !== bass)
}
