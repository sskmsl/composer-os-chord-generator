import { sectionRule, type Mode, type MoodId, type SectionId, type StyleId } from "@/types/music"
import type { Scores } from "@/types/progression"
import type { ParsedChord } from "./degrees"
import { chordPitchClasses, degreeSemitone, upperPitchClasses } from "./degrees"
import { jitter } from "./random"

/** 進行から検出した音楽的特徴。スコアと説明文の両方の根拠になる */
export interface Features {
  minor: boolean
  hasDim: boolean
  hasBII: boolean
  hasV7: boolean
  hasBVI: boolean
  hasBVII: boolean
  hasAug: boolean
  hasBviBviiTonic: boolean
  hasBorrowed: boolean
  hasSlash: boolean
  colorCount: number
  softColorCount: number
  descendingBass: boolean
  ascendingBass: boolean
  pedalBass: boolean
  endsOnTonic: boolean
  endsUnresolved: boolean
  dominantPrep: boolean
  largeArc: boolean
  /** 隣接コード間で共有される構成音の平均数(声部の滑らかさ・共通音の効果) */
  commonToneStrength: number
  /** ベース以外の構成音が半音で動く箇所がある(内声の半音進行) */
  chromaticInnerMotion: boolean
  /** dim/bII/aug/借用/#IVなど、耳を引く"毒"の要素数 */
  surpriseCount: number
  /** 色彩和音も借用もスラッシュもペダルも意外性もない、教科書的で平板な進行 */
  plainDiatonic: boolean
  /** 装飾・借用・意外性が詰め込まれすぎて、シンプルさを失っている */
  overDecorated: boolean
  /** 終止の型(理論的な説明・分析用) */
  cadence: CadenceType
}

/**
 * 終止の型。 authentic=完全終止(V→I) / half=半終止(Vで止める) /
 * deceptive=偽終止(Vから予想外の和音へ) / plagal=変終止(IV→I) /
 * modal=機能和声に依らない終止(旋法的・借用和音的な着地)
 */
export type CadenceType = "authentic" | "half" | "deceptive" | "plagal" | "modal"

const COLOR_SUFFIXES = ["add9", "maj7", "m9", "m11", "11", "sus2", "sus4", "7sus4", "6", "aug"]
const SOFT_COLORS = ["add9", "maj7", "m9", "m11", "11"]

function bassSemitone(c: ParsedChord): number {
  return c.bass ? degreeSemitone(c.bass.acc, c.bass.roman) : degreeSemitone(c.acc, c.roman)
}

/** 半音差を「最短経路」で解釈して下降/上昇を判定する */
function isDescStep(prev: number, cur: number): boolean {
  if (prev === cur) return false
  return (prev - cur + 12) % 12 <= 5
}

/** 末尾2和音の関係から終止の型を判定する(機能和声の一般的な分類。特定楽曲への依存なし) */
function detectCadence(chords: ParsedChord[], minor: boolean): CadenceType {
  if (chords.length < 2) return "modal"
  const last = chords[chords.length - 1]
  const prev = chords[chords.length - 2]
  const lastSemi = degreeSemitone(last.acc, last.roman)
  const prevSemi = degreeSemitone(prev.acc, prev.roman)

  const lastIsTonic = lastSemi === 0 && last.lower === minor
  const lastIsDominant = !last.lower && lastSemi === 7
  const prevIsDominant = !prev.lower && prevSemi === 7
  const prevIsSubdominant = prevSemi === 5 && prev.lower === minor

  if (lastIsDominant) return "half"
  if (prevIsDominant) return lastIsTonic ? "authentic" : "deceptive"
  if (prevIsSubdominant && lastIsTonic) return "plagal"
  return "modal"
}

export function extractFeatures(chords: ParsedChord[], mode: Mode): Features {
  const minor = mode === "minor"
  const semis = chords.map((c) => degreeSemitone(c.acc, c.roman))
  const basses = chords.map(bassSemitone)
  const last = chords[chords.length - 1]

  const hasDim = chords.some((c) => c.suffix === "dim" || c.suffix === "ø")
  const hasBII = chords.some((c) => c.acc === -1 && c.roman === "II")
  const hasV7 = chords.some(
    (c) => !c.lower && c.roman === "V" && (c.suffix === "7" || c.suffix === "7sus4"),
  )
  const hasBVI = semis.includes(8)
  const hasBVII = semis.includes(10)
  const hasAug = chords.some((c) => c.suffix === "aug")
  const hasSharpIV = chords.some((c) => c.acc === 1 && c.roman === "IV")

  let hasBviBviiTonic = false
  for (let i = 0; i + 2 < semis.length; i++) {
    if (semis[i] === 8 && semis[i + 1] === 10 && semis[i + 2] === 0) hasBviBviiTonic = true
  }

  const hasBorrowed = minor
    ? hasBII || chords.some((c) => c.acc === 1 && c.roman === "IV") || hasV7
    : chords.some((c) => c.lower && c.roman === "IV")

  const descSteps = basses.slice(1).filter((b, i) => isDescStep(basses[i], b)).length
  const ascSteps = basses.slice(1).filter((b, i) => b !== basses[i] && !isDescStep(basses[i], b)).length
  const pedalSteps = basses.slice(1).filter((b, i) => b === basses[i]).length

  const endsOnTonic = degreeSemitone(last.acc, last.roman) === 0 && last.lower === minor
  const endsUnresolved =
    !endsOnTonic || last.suffix.includes("sus") || last.suffix === "add9" || last.suffix === "11"

  let dominantPrep = false
  for (let i = 0; i + 1 < semis.length; i++) {
    if (semis[i] === 7 && !chords[i].lower && semis[i + 1] === 0) dominantPrep = true
  }

  const range = Math.max(...semis) - Math.min(...semis)

  const hasSlash = chords.some((c) => c.bass != null)
  const colorCount = chords.filter((c) => COLOR_SUFFIXES.includes(c.suffix)).length
  const pedalBass = pedalSteps >= 2

  // 隣接コード間の共通音(声部の滑らかさ)と、内声(ベース以外)の半音進行を検出する
  let commonToneTotal = 0
  let chromaticInnerMotion = false
  for (let i = 1; i < chords.length; i++) {
    const prevAll = chordPitchClasses(chords[i - 1])
    const curAll = chordPitchClasses(chords[i])
    commonToneTotal += prevAll.filter((pc) => curAll.includes(pc)).length

    const prevUpper = upperPitchClasses(chords[i - 1])
    const curUpper = upperPitchClasses(chords[i])
    const hasHalfStep = prevUpper.some((p) =>
      curUpper.some((q) => {
        const diff = Math.abs(p - q)
        return diff === 1 || diff === 11
      }),
    )
    if (hasHalfStep) chromaticInnerMotion = true
  }
  const commonToneStrength = commonToneTotal / Math.max(1, chords.length - 1)

  // 耳を引く"毒"の要素(dim/bII/aug/借用/#IV等)を数える。Boutonnat的には0でも多すぎても良くない
  const surpriseCount =
    (hasDim ? 1 : 0) +
    (hasBII ? 1 : 0) +
    (hasAug ? 1 : 0) +
    (hasSharpIV ? 1 : 0) +
    (minor && hasV7 ? 1 : 0) +
    (!minor && hasBorrowed ? 1 : 0)

  const plainDiatonic = colorCount === 0 && !hasBorrowed && !hasSlash && !pedalBass && surpriseCount === 0
  const overDecorated = colorCount >= chords.length && surpriseCount >= 2

  return {
    minor,
    hasDim,
    hasBII,
    hasV7,
    hasBVI,
    hasBVII,
    hasAug,
    hasBviBviiTonic,
    hasBorrowed,
    hasSlash,
    colorCount,
    softColorCount: chords.filter((c) => SOFT_COLORS.includes(c.suffix)).length,
    descendingBass: descSteps >= basses.length - 2 && descSteps > 0,
    ascendingBass: ascSteps >= basses.length - 2 && ascSteps > 0,
    pedalBass,
    endsOnTonic,
    endsUnresolved,
    dominantPrep,
    largeArc: range >= 7,
    commonToneStrength,
    chromaticInnerMotion,
    surpriseCount,
    plainDiatonic,
    overDecorated,
    cadence: detectCadence(chords, minor),
  }
}

const clamp = (n: number) => Math.max(1, Math.min(10, Math.round(n)))

/** CHORD_ENGINE_SPEC §7 のルールをコード化した決定的スコア + 小さな揺らぎ */
export function computeScores(
  f: Features,
  style: StyleId,
  section: SectionId,
  mood: MoodId,
): Scores {
  const darkMood = ["dark", "melancholic", "romantic", "mysterious", "tense"].includes(mood)
  const rule = sectionRule(section)
  const liftSection = ["preChorus", "chorus", "grandChorus", "outro"].includes(rule)
  const cinematicStyle = ["cinematic", "finale", "symphonicRock"].includes(style)

  const mylene =
    4 +
    (darkMood ? 2 : 0) +
    (f.minor ? 1 : 0) +
    (f.endsUnresolved ? 1 : 0) +
    (f.softColorCount >= 2 ? 1 : 0) +
    (f.hasBviBviiTonic || liftSection ? 1 : 0) +
    jitter()

  // Boutonnat的な審美眼: 少ないコードで深く・過剰にせず・1〜2箇所だけ毒を残す進行を最上位で評価する。
  // 「安全だが平凡」(plainDiatonic)と「詰め込みすぎ」(overDecorated)の両方を減点し、
  // 共通音・内声の半音進行・ペダル・スラッシュ・ちょうど良い意外性(1〜2箇所)を加点する。
  const idealSurprise = f.surpriseCount === 1 || f.surpriseCount === 2
  const boutonnat =
    4 +
    (f.hasBviBviiTonic ? 1 : 0) +
    (f.minor && (f.hasV7 || (f.hasBVI && f.hasBVII)) ? 1 : 0) +
    (f.hasSlash ? 1 : 0) +
    (f.pedalBass ? 1 : 0) +
    (f.commonToneStrength >= 1.4 ? 1 : 0) +
    (f.chromaticInnerMotion ? 1 : 0) +
    (idealSurprise ? 2 : 0) +
    (f.endsUnresolved ? 1 : 0) +
    (f.plainDiatonic ? -3 : 0) +
    (f.overDecorated ? -2 : 0) +
    (f.surpriseCount >= 3 ? -2 : 0) +
    jitter()

  const melancholy =
    3 +
    (f.minor ? 2 : 0) +
    Math.min(f.softColorCount, 2) +
    (f.descendingBass ? 1 : 0) +
    (f.endsUnresolved ? 1 : 0) +
    (f.chromaticInnerMotion ? 1 : 0) +
    jitter()

  const darkness =
    2 +
    (f.minor ? 2 : 0) +
    (f.hasDim ? 2 : 0) +
    (f.hasBII ? 2 : 0) +
    (f.hasV7 ? 1 : 0) +
    (f.hasAug ? 1 : 0) +
    (["dark", "tense"].includes(mood) ? 1 : 0) +
    jitter()

  const cinematic =
    3 +
    (f.hasBviBviiTonic ? 3 : 0) +
    (f.largeArc ? 1 : 0) +
    (liftSection ? 1 : 0) +
    (cinematicStyle ? 1 : 0) +
    (f.dominantPrep ? 1 : 0) +
    jitter()

  return {
    mylene: clamp(mylene),
    boutonnat: clamp(boutonnat),
    melancholy: clamp(melancholy),
    darkness: clamp(darkness),
    cinematic: clamp(cinematic),
  }
}
