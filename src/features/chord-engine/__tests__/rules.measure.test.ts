/// <reference types="node" />
import { writeFileSync } from "node:fs"
import { expect, it } from "vitest"
import { clearSessionSkeletonHistory, generateProgressions, rootSkeletonOf, type PreviousSection } from "../generateProgressions"
import { parseToken } from "../degrees"
import { computeScores, extractFeatures } from "../scoring"
import { generateChain } from "../transitions"
import { isDefiniteMajorV, rootKey } from "../styleGrammar"
import { resolveKeyMove, rotateLoop, toParallelMinor } from "../songFlow"
import { STYLE_OPTIONS } from "../templates"
import type { MusicKey, SectionId, StyleId } from "@/types/music"
import { SEEDS, seededRandom } from "./seeded"

/**
 * ドラマティック・マイナーの各規則が、採点と選抜のあとでどれだけ残るかを測る(環境変数指定時のみ)。
 * Phase 0 と同じ固定seed・A短調・mood=melancholic。対照は previous を渡さない同条件の生成。
 */
const A_MINOR: MusicKey = { tonic: "A", mode: "minor" }
const PREVIOUS_LOOP = ["bVII", "i", "bIII", "bVI"]
const previous: PreviousSection = { key: A_MINOR, loop: PREVIOUS_LOOP }
const rotations = PREVIOUS_LOOP.map((_, i) => rotateLoop(PREVIOUS_LOOP, i).join("-"))
const LOOP_RIGHT = ["i", "bVI", "bVII", "bIII"]
const loopRotations = LOOP_RIGHT.map((_, i) => rotateLoop(LOOP_RIGHT, i).join("-"))
const ROUNDS = 40
const originalRandom = Math.random

function collect(
  style: StyleId,
  section: SectionId,
  options: { previous?: PreviousSection; length?: number; key?: MusicKey; originalKey?: MusicKey } = {},
) {
  const rows: string[][] = []
  for (const seed of SEEDS) {
    // 呼び出しを記録するspyだと乱数の呼び出し数だけメモリを使うので、直接差し替える
    Math.random = seededRandom(seed)
    clearSessionSkeletonHistory()
    for (let i = 0; i < ROUNDS; i++) {
      for (const p of generateProgressions({ key: options.key ?? A_MINOR, style, section, mood: "melancholic", count: 5, length: (options.length ?? 4) as 4, previous: options.previous, originalKey: options.originalKey })) {
        rows.push(p.romanNumerals)
      }
    }
    Math.random = originalRandom
  }
  return rows
}

const rate = (rows: string[][], test: (tokens: string[]) => boolean) => rows.filter(test).length / rows.length
const definite = (tokens: string[]) => tokens.map(parseToken).filter(isDefiniteMajorV).length

it.skipIf(!process.env.CHORD_RULES_PATH)("measures how the dramatic minor rules survive selection", () => {
  const styles = STYLE_OPTIONS.map((s) => s.value)
  const output: Record<string, unknown> = {}
  const isRotation = (tokens: string[]) => rotations.includes(rootSkeletonOf(tokens))
  try {
    output.chorusRotation = Object.fromEntries(styles.map((style) => {
      const control = collect(style, "chorus")
      const withPrevious = collect(style, "chorus", { previous })
      return [style, { control: rate(control, isRotation), withPrevious: rate(withPrevious, isRotation), count: withPrevious.length }]
    }))
    output.cMelodyBridgeReuse = Object.fromEntries((["c-melody", "bridge"] as const).map((section) => [section, Object.fromEntries(styles.map((style) => {
      const control = collect(style, section)
      const withPrevious = collect(style, section, { previous })
      return [style, { control: rate(control, isRotation), withPrevious: rate(withPrevious, isRotation) }]
    }))]))
    output.intro = Object.fromEntries(styles.map((style) => {
      const rows = collect(style, "intro")
      return [style, {
        repeat: rate(rows, (t) => t.length >= 4 && t.every((x, i) => rootKey(x) === rootKey(t[i % 2]))),
        turnaround: rate(rows, (t) => t.length >= 2 && rootKey(t[t.length - 2]) === "V" && rootKey(t[t.length - 1]) === "i"),
        decisiveTurnaround: rate(rows, (t) => t.length >= 2 && isDefiniteMajorV(parseToken(t[t.length - 2])) && rootKey(t[t.length - 1]) === "i"),
        endsOnTonic: rate(rows, (t) => rootKey(t[t.length - 1]) === "i"),
      }]
    }))
    output.definiteMajorV = Object.fromEntries(styles.map((style) => {
      const counts: Record<string, number> = {}
      for (const section of ["intro", "verse", "pre-chorus", "chorus", "c-melody", "bridge", "outro"] as const) {
        for (const length of [4, 8]) {
          const rows = collect(style, section, { length })
          counts[`${section}/${length}`] = Math.max(...rows.map(definite))
        }
      }
      return [style, { maxPerProgression: Math.max(...Object.values(counts)) }]
    }))
    output.loopTemplate = Object.fromEntries((["cinematic", "finale"] as const).map((style) => [style, { share: rate(collect(style, "chorus"), (t) => loopRotations.includes(rootSkeletonOf(t))) }]))
    // 原調への帰還(bVI → bVII → 主和音で着地)。対照は originalKey を渡さない同条件
    const awayKey = resolveKeyMove(A_MINOR, "relative")
    const away: PreviousSection = { key: awayKey, loop: PREVIOUS_LOOP }
    const homeTail = (t: string[]) => t.slice(-3).map(rootKey).join("-") === "bVI-bVII-i"
    output.homeReturn = Object.fromEntries(styles.map((style) => [style, Object.fromEntries((["chorus", "grand-chorus", "outro"] as const).map((section) => {
      const control = collect(style, section, { previous: away })
      const withOriginal = collect(style, section, { previous: away, originalKey: A_MINOR })
      return [section, { control: rate(control, homeTail), withOriginal: rate(withOriginal, homeTail) }]
    }))]))
    // 同主短調への一時暗転(C長調 → C短調の落ちサビで、前の長調ループを借用和音にする)
    const C_MAJOR: MusicKey = { tonic: "C", mode: "major" }
    const C_MINOR = resolveKeyMove(C_MAJOR, "parallel")
    const darkHead = toParallelMinor(["I", "vi", "IV", "V"]).slice(0, 3).map(rootKey).join("-")
    const isDarkHead = (t: string[]) => t.slice(0, 3).map(rootKey).join("-") === darkHead
    output.parallelDarkening = Object.fromEntries(styles.map((style) => {
      const control = collect(style, "breakdown-chorus", { key: C_MINOR })
      const withPrevious = collect(style, "breakdown-chorus", { key: C_MINOR, previous: { key: C_MAJOR, loop: ["I", "vi", "IV", "V"] }, originalKey: C_MAJOR })
      return [style, { control: rate(control, isDarkHead), withPrevious: rate(withPrevious, isDarkHead) }]
    }))
    // 採点の plainDiatonic(装飾・借用・スラッシュ・ペダル・意外性が無い進行を減点)が新しいループを不当に落とさないかの実測。
    // 選抜前(遷移表の生の進行)と選抜後で、plainDiatonic の割合と平均点を比べる
    const plainStats = (rows: string[][]) => {
      const scored = rows.map((tokens) => {
        const features = extractFeatures(tokens.map(parseToken), "minor")
        return { plain: features.plainDiatonic, score: computeScores(features).boutonnat }
      })
      const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length)
      return {
        plainShare: scored.filter((r) => r.plain).length / scored.length,
        meanPlain: mean(scored.filter((r) => r.plain).map((r) => r.score)),
        meanOther: mean(scored.filter((r) => !r.plain).map((r) => r.score)),
      }
    }
    const rawChains = (style: StyleId) => {
      const rows: string[][] = []
      for (const seed of SEEDS) {
        Math.random = seededRandom(seed)
        for (let i = 0; i < 200; i++) rows.push(generateChain(style, "minor", "melancholic", 4))
        Math.random = originalRandom
      }
      return rows
    }
    output.plainDiatonic = Object.fromEntries(styles.map((style) => {
      const selected = collect(style, "chorus")
      const loops = selected.filter((t) => loopRotations.includes(rootSkeletonOf(t)))
      return [style, {
        raw: plainStats(rawChains(style)),
        selected: plainStats(selected),
        selectedLoop: loops.length > 0 ? { count: loops.length, ...plainStats(loops) } : null,
      }]
    }))
    expect(Object.keys(output)).toHaveLength(8)
    writeFileSync(process.env.CHORD_RULES_PATH!, JSON.stringify({ conditions: { seeds: SEEDS, rounds: ROUNDS, count: 5, tonic: "A", mode: "minor", mood: "melancholic", previousLoop: PREVIOUS_LOOP }, ...output }, null, 2) + "\n")
  } finally {
    Math.random = originalRandom
    clearSessionSkeletonHistory()
  }
}, 600000)
