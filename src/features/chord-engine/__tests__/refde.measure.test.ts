/// <reference types="node" />
import { writeFileSync } from "node:fs"
import { expect, it } from "vitest"
import { clearSessionSkeletonHistory, generateProgressions, rootSkeletonOf } from "../generateProgressions"
import { parseToken } from "../degrees"
import { isDefiniteMajorV, relativeMajorDominant, rootKey, styleVocabulary } from "../styleGrammar"
import { rotateLoop } from "../songFlow"
import { STYLE_OPTIONS } from "../templates"
import type { MusicKey, SectionId, StyleId } from "@/types/music"
import { SEEDS, seededRandom } from "./seeded"

/**
 * 参照D・Eの規則が、採点と選抜のあとでどれだけ残るかを測る(環境変数指定時のみ)。
 * Phase 0 と同じ固定seed・A短調(規則4はC長調)・mood=melancholic・4コード・各seed 40回。
 */
const A_MINOR: MusicKey = { tonic: "A", mode: "minor" }
const C_MAJOR: MusicKey = { tonic: "C", mode: "major" }
const ROUNDS = 40
const originalRandom = Math.random

function collect(style: StyleId, section: SectionId, key: MusicKey, extra: { approachRelativeMajor?: boolean; length?: number } = {}) {
  const rows: string[][] = []
  for (const seed of SEEDS) {
    Math.random = seededRandom(seed)
    clearSessionSkeletonHistory()
    for (let i = 0; i < ROUNDS; i++) {
      for (const p of generateProgressions({ key, style, section, mood: "melancholic", count: 5, length: (extra.length ?? 4) as 4, approachRelativeMajor: extra.approachRelativeMajor })) rows.push(p.romanNumerals)
    }
    Math.random = originalRandom
  }
  return rows
}

const rate = (rows: string[][], test: (tokens: string[]) => boolean) => rows.filter(test).length / rows.length

it.skipIf(!process.env.CHORD_REFDE_PATH)("measures how the reference D and E rules survive selection", () => {
  const styles = STYLE_OPTIONS.map((s) => s.value)
  const output: Record<string, unknown> = {}
  try {
    const endsOnBVII7 = (t: string[]) => t[t.length - 1] === "bVII7"
    output.preChorusApproach = Object.fromEntries(styles.map((style) => {
      const control = collect(style, "pre-chorus", A_MINOR)
      const approach = collect(style, "pre-chorus", A_MINOR, { approachRelativeMajor: true })
      const control8 = collect(style, "pre-chorus", A_MINOR, { length: 8 })
      const approach8 = collect(style, "pre-chorus", A_MINOR, { approachRelativeMajor: true, length: 8 })
      return [style, {
        offered: relativeMajorDominant(style, "minor") !== null,
        control: rate(control, endsOnBVII7),
        approach: rate(approach, endsOnBVII7),
        control8: rate(control8, endsOnBVII7),
        approach8: rate(approach8, endsOnBVII7),
      }]
    }))

    const isSus = (t: string) => ["sus2", "sus4"].includes(parseToken(t).suffix)
    const contrasted = (t: string[]) => {
      const v = t.map(parseToken).filter(isDefiniteMajorV)
      const others = t.filter((x) => !isDefiniteMajorV(parseToken(x)))
      return v.length === 1 && v[0].suffix === "7" && others.length > 0 && others.filter(isSus).length * 2 >= others.length
    }
    output.susContrast = Object.fromEntries(styles.map((style) => {
      const suffixes = styleVocabulary(style, "minor").suffixes
      const rows = (["intro", "verse", "pre-chorus", "chorus", "c-melody", "bridge", "outro"] as const).flatMap((s) => collect(style, s, A_MINOR))
      return [style, {
        susInVocabulary: suffixes.has("sus2") || suffixes.has("sus4"),
        sevenInVocabulary: suffixes.has("7"),
        contrasted: rate(rows, contrasted),
        maxDecisiveV: Math.max(...rows.map((t) => t.map(parseToken).filter(isDefiniteMajorV).length)),
      }]
    }))

    const shape = ["I", "bVII", "I", "ii"]
    const rotations = shape.map((_, i) => rotateLoop(shape, i).join("-"))
    output.majorTemplate = Object.fromEntries(styles.map((style) => [style, rate(collect(style, "chorus", C_MAJOR), (t) => rotations.includes(rootSkeletonOf(t)))]))
    output.majorVocabularyRoots = Object.fromEntries(styles.map((style) => [style, [...styleVocabulary(style, "major").roots].includes(rootKey("bVII"))]))
    expect(Object.keys(output)).toHaveLength(4)
    writeFileSync(process.env.CHORD_REFDE_PATH!, JSON.stringify({ conditions: { seeds: SEEDS, rounds: ROUNDS, count: 5, length: 4, minorKey: "A", majorKey: "C", mood: "melancholic" }, ...output }, null, 2) + "\n")
  } finally {
    Math.random = originalRandom
    clearSessionSkeletonHistory()
  }
}, 600000)
