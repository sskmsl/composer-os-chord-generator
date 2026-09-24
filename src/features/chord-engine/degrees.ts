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
  "F-major", "Bb-major", "Eb-major", "Ab-major", "Db-major", "Gb-major",
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

/** フラット表記の調か(Ebm・Gb など)。同じ音の調が2つあるとき、元の調に綴りを揃えるのに使う */
export function isFlatKey(key: MusicKey): boolean {
  return FLAT_KEYS.has(`${key.tonic}-${key.mode}`)
}

/** 短調の bIII・bVI・bVII は自然短音階の音(調の中の音)なので、調の綴りに従う */
const MINOR_SCALE_FLAT_DEGREES = new Set(["III", "VI", "VII"])

/**
 * @param acc 度数に付いた臨時記号。♭の付いた度数(bVII等)は調に関わらず♭で、
 *   ♯の付いた度数(#iv等)は♯で綴る。Cメジャーの bVII が "A#" ではなく "Bb" になる。
 *   ただし短調の bIII・bVI・bVII は調の綴り(G#m の bVII は Gb ではなく F#)。
 */
function noteName(pc: number, key: MusicKey, acc = 0, roman = ""): string {
  const inMinorScale = acc === -1 && key.mode === "minor" && MINOR_SCALE_FLAT_DEGREES.has(roman)
  const useFlats = inMinorScale ? isFlatKey(key) : acc === -1 || (acc === 0 && isFlatKey(key))
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
  const root = noteName(rootPc(parsed, key), key, parsed.acc, parsed.roman)
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
    name += "/" + noteName(bassPc(parsed, key), key, parsed.bass.acc, parsed.bass.roman)
  }
  return name
}

export function bassNoteName(parsed: ParsedChord, key: MusicKey): string {
  return noteName(bassPc(parsed, key), key, parsed.bass?.acc ?? parsed.acc, parsed.bass?.roman ?? parsed.roman)
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

/**
 * 半音(0〜11)から、進行内で使われている表記慣習に沿ったディグリー表記へ変換する。
 * (bII/bIII/#IV/bVI/bVII は既存テンプレートで使われている借用和音の綴りと一致させてある)
 * 転回形のベース音(和音の3度・5度)をディグリー記号として表すための共有ユーティリティ。
 */
const SEMITONE_TO_DEGREE: { acc: number; roman: string }[] = [
  { acc: 0, roman: "I" },
  { acc: -1, roman: "II" },
  { acc: 0, roman: "II" },
  { acc: -1, roman: "III" },
  { acc: 0, roman: "III" },
  { acc: 0, roman: "IV" },
  { acc: 1, roman: "IV" },
  { acc: 0, roman: "V" },
  { acc: -1, roman: "VI" },
  { acc: 0, roman: "VI" },
  { acc: -1, roman: "VII" },
  { acc: 0, roman: "VII" },
]

export function degreeForSemitone(semitone: number): { acc: number; roman: string } {
  return SEMITONE_TO_DEGREE[((semitone % 12) + 12) % 12]
}

const ROMAN_ORDER = ["I", "II", "III", "IV", "V", "VI", "VII"]
/** 根音からの半音数 → 何度上の音か(3度=2ステップ、5度=4ステップ等) */
const INTERVAL_STEPS = [0, 1, 1, 2, 2, 3, 4, 4, 4, 5, 6, 6]

/**
 * コードの構成音(転回形のベース等)を、そのコードの根音から数えた度数で綴る。
 * 例: Cメジャーの III7(E7)の3度は bVI(Ab)ではなく #V(G#)。
 * 半音数だけから度数を決めると、♭の付いた度数を♭で綴る規則により E7/Ab のような
 * 誤った表記になるため、根音の文字から3度・5度…上の文字を使う。
 */
export function chordToneDegree(root: { acc: number; roman: string }, interval: number): { acc: number; roman: string } {
  const rootIndex = ROMAN_ORDER.indexOf(root.roman)
  const semitone = (degreeSemitone(root.acc, root.roman) + interval) % 12
  if (rootIndex < 0) return degreeForSemitone(semitone)
  const roman = ROMAN_ORDER[(rootIndex + INTERVAL_STEPS[((interval % 12) + 12) % 12]) % 7]
  const diff = (semitone - degreeSemitone(0, roman) + 12) % 12
  const acc = diff === 0 ? 0 : diff === 1 ? 1 : diff === 11 ? -1 : null
  // 重嬰・重変になる場合だけは半音数からの綴りに戻す
  return acc === null ? degreeForSemitone(semitone) : { acc, roman }
}

/** コード名の品質 → ディグリー表記の品質(小文字=マイナー系か、サフィックス) */
const QUALITY_TO_TOKEN: Record<string, { lower: boolean; suffix: string }> = {
  "": { lower: false, suffix: "" },
  m: { lower: true, suffix: "" },
  dim: { lower: true, suffix: "dim" },
  aug: { lower: false, suffix: "aug" },
  m7b5: { lower: true, suffix: "ø" },
  "ø": { lower: true, suffix: "ø" },
  maj7: { lower: false, suffix: "maj7" },
  mMaj7: { lower: true, suffix: "maj7" },
  "7": { lower: false, suffix: "7" },
  m7: { lower: true, suffix: "7" },
  add9: { lower: false, suffix: "add9" },
  "m(add9)": { lower: true, suffix: "add9" },
  madd9: { lower: true, suffix: "add9" },
  m9: { lower: true, suffix: "m9" },
  m11: { lower: true, suffix: "11" },
  "11": { lower: false, suffix: "11" },
  sus2: { lower: false, suffix: "sus2" },
  sus4: { lower: false, suffix: "sus4" },
  "7sus4": { lower: false, suffix: "7sus4" },
  "6": { lower: false, suffix: "6" },
  m6: { lower: true, suffix: "6" },
}

/** 表にない品質(9, maj9, 13 など)を、響きの近い品質へ寄せる */
function nearestQuality(quality: string): { lower: boolean; suffix: string } {
  const exact = QUALITY_TO_TOKEN[quality]
  if (exact) return exact
  if (/^maj/.test(quality)) return QUALITY_TO_TOKEN.maj7
  if (/^m(?!aj)/.test(quality)) return /\d/.test(quality) ? QUALITY_TO_TOKEN.m7 : QUALITY_TO_TOKEN.m
  if (/^(9|13|7)/.test(quality)) return QUALITY_TO_TOKEN["7"]
  if (/^sus/.test(quality)) return QUALITY_TO_TOKEN.sus4
  return QUALITY_TO_TOKEN[""]
}

const THIRDLESS_SUFFIXES = new Set(["sus2", "sus4", "7sus4", "aug"])
/** 短調(i ii° bIII iv V bVI bVII。属和音は和声的短音階の長三和音)・長音階(I ii iii IV V vi vii°)で短三和音系になる度数 */
const MINOR_KEY_LOWER = new Set(["0:I", "0:II", "0:IV"])
const MAJOR_KEY_LOWER = new Set(["0:II", "0:III", "0:VI", "0:VII"])

function diatonicIsMinor(degree: { acc: number; roman: string }, key: MusicKey): boolean {
  return (key.mode === "minor" ? MINOR_KEY_LOWER : MAJOR_KEY_LOWER).has(`${degree.acc}:${degree.roman}`)
}

/**
 * 実コード名(例: "Dbmaj7/F")を、キーから見たディグリー表記(例: "bIImaj7/iv")へ戻す。
 * 手で書き換えたコードから、度数表記・スコア・説明文を計算し直すために使う。
 * 度数は半音数で決まる慣習的な綴りになる(Aマイナーの "Db" は III)。
 * 解釈できない表記は null。
 */
export function tokenFromChordSymbol(symbol: string, key: MusicKey): string | null {
  const [main, bassName] = symbol.trim().split("/")
  const m = /^([A-G][#b]?)(.*)$/.exec(main.trim())
  if (!m) return null
  const rootPcValue = NOTE_TO_PC[m[1]]
  const tonicPc = NOTE_TO_PC[key.tonic]
  if (rootPcValue == null || tonicPc == null) return null
  // 度数は進行内の綴りの慣習(bIII・bVI・#IV等)で表す。入力したコード名の綴り自体は呼び出し側でそのまま残す
  const degree = degreeForSemitone(rootPcValue - tonicPc)
  const quality = nearestQuality(m[2].trim())
  // 3度を含まない和音(sus・aug)は、その度数の調の中での三和音に合わせて大文字・小文字を決める
  const lower = THIRDLESS_SUFFIXES.has(quality.suffix) ? diatonicIsMinor(degree, key) : quality.lower
  const suffix = quality.suffix
  const parsed: ParsedChord = { token: "", acc: degree.acc, roman: degree.roman, lower, suffix }
  if (bassName != null) {
    const bassValue = NOTE_TO_PC[bassName.trim()]
    if (bassValue == null) return null
    if (bassValue !== rootPcValue) {
      // 構成音のベース(転回形)は根音から数えた度数で、それ以外(ペダル等)は調から見た度数で綴る
      const interval = (bassValue - rootPcValue + 12) % 12
      const bassDegree = chordIntervals(parsed).some((i) => i % 12 === interval)
        ? chordToneDegree(degree, interval)
        : degreeForSemitone(bassValue - tonicPc)
      const accStr = bassDegree.acc === -1 ? "b" : bassDegree.acc === 1 ? "#" : ""
      parsed.bass = { acc: bassDegree.acc, roman: bassDegree.roman, raw: `${accStr}${bassDegree.roman.toLowerCase()}` }
    }
  }
  return buildToken(parsed)
}
