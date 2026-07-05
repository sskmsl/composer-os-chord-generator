import type { Mode, MoodId, SectionId, StyleId } from "@/types/music"
import type { Scores } from "@/types/progression"
import type { ParsedChord } from "./degrees"
import { degreeSemitone } from "./degrees"
import { jitter } from "./random"

/** 進行から検出した音楽的特徴。スコアと説明文の両方の根拠になる */
export interface Features {
  minor: boolean
  hasDim: boolean
  hasBII: boolean
  hasV7: boolean
  hasBVI: boolean
  hasBVII: boolean
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
}

const COLOR_SUFFIXES = ["add9", "maj7", "m9", "m11", "11", "sus2", "sus4", "7sus4", "6"]
const SOFT_COLORS = ["add9", "maj7", "m9", "m11", "11"]

function bassSemitone(c: ParsedChord): number {
  return c.bass ? degreeSemitone(c.bass.acc, c.bass.roman) : degreeSemitone(c.acc, c.roman)
}

/** 半音差を「最短経路」で解釈して下降/上昇を判定する */
function isDescStep(prev: number, cur: number): boolean {
  if (prev === cur) return false
  return (prev - cur + 12) % 12 <= 5
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

  return {
    minor,
    hasDim,
    hasBII,
    hasV7,
    hasBVI,
    hasBVII,
    hasBviBviiTonic,
    hasBorrowed,
    hasSlash: chords.some((c) => c.bass != null),
    colorCount: chords.filter((c) => COLOR_SUFFIXES.includes(c.suffix)).length,
    softColorCount: chords.filter((c) => SOFT_COLORS.includes(c.suffix)).length,
    descendingBass: descSteps >= basses.length - 2 && descSteps > 0,
    ascendingBass: ascSteps >= basses.length - 2 && ascSteps > 0,
    pedalBass: pedalSteps >= 2,
    endsOnTonic,
    endsUnresolved,
    dominantPrep,
    largeArc: range >= 7,
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
  const liftSection = ["preChorus", "chorus", "outro"].includes(section)
  const orchestralSection = ["preChorus", "chorus", "bridge"].includes(section)
  const cinematicStyle = ["cinematic", "finale", "symphonicRock"].includes(style)

  const mylene =
    4 +
    (darkMood ? 2 : 0) +
    (f.minor ? 1 : 0) +
    (f.endsUnresolved ? 1 : 0) +
    (f.softColorCount >= 2 ? 1 : 0) +
    (f.hasBviBviiTonic || liftSection ? 1 : 0) +
    jitter()

  const boutonnat =
    3 +
    (f.hasBviBviiTonic ? 2 : 0) +
    (f.minor && (f.hasV7 || (f.hasBVI && f.hasBVII)) ? 2 : 0) +
    (orchestralSection || cinematicStyle ? 1 : 0) +
    (f.hasSlash ? 1 : 0) +
    (f.largeArc ? 1 : 0) +
    jitter()

  const melancholy =
    3 +
    (f.minor ? 2 : 0) +
    Math.min(f.softColorCount, 2) +
    (f.descendingBass ? 1 : 0) +
    (f.endsUnresolved ? 1 : 0) +
    jitter()

  const darkness =
    2 +
    (f.minor ? 2 : 0) +
    (f.hasDim ? 2 : 0) +
    (f.hasBII ? 2 : 0) +
    (f.hasV7 ? 1 : 0) +
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
