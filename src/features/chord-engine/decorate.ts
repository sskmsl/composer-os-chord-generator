import type { MoodId, StyleId } from "@/types/music"
import type { ParsedChord } from "./degrees"
import { buildToken } from "./degrees"
import { MOOD_PROFILES, STYLE_PREFS } from "./templates"
import { chance, pick } from "./random"

/**
 * 素の三和音にスタイル・ムードに応じたカラー(add9/maj7/sus等)と
 * スラッシュベースを確率的に付加する。dim/ø は装飾しない。
 */
export function decorateProgression(
  chords: ParsedChord[],
  style: StyleId,
  mood: MoodId,
): ParsedChord[] {
  const prefs = STYLE_PREFS[style]
  const moodColors = MOOD_PROFILES[mood].colors

  return chords.map((chord, index) => {
    const result: ParsedChord = { ...chord, bass: chord.bass ? { ...chord.bass } : undefined }

    const isDominant = !result.lower && result.roman === "V" && result.acc === 0
    const canDecorate =
      result.suffix === "" && !["dim", "ø"].includes(result.suffix)

    if (canDecorate && chance(prefs.decorationProb)) {
      const base = isDominant
        ? ["sus4", "7", "7sus4"]
        : result.lower
          ? prefs.minorColors
          : prefs.majorColors
      // ムードの好みと交差する装飾があれば優先する
      const preferred = base.filter((c) => moodColors.includes(c))
      result.suffix = preferred.length > 0 && chance(0.6) ? pick(preferred) : pick(base)
    }

    // スラッシュベース: bVI→トニックペダル、bIII→5度上ベース(仕様の例に準拠)
    if (!result.bass && chance(prefs.slashProb)) {
      if (result.acc === -1 && result.roman === "VI" && index > 0) {
        result.bass = { acc: 0, roman: "I", raw: "i" }
      } else if (result.acc === -1 && result.roman === "III") {
        result.bass = { acc: 0, roman: "V", raw: "V" }
      }
    }

    result.token = buildToken(result)
    return result
  })
}
