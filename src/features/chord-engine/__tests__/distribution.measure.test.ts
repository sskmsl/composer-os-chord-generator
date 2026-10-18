/// <reference types="node" />
import { writeFileSync } from "node:fs"
import { expect, it, vi } from "vitest"
import { clearSessionSkeletonHistory, generateProgressions, rootSkeletonOf } from "../generateProgressions"
import { generateChain, continuationsOf } from "../transitions"
import { STYLE_OPTIONS } from "../templates"
import { computeScores, extractFeatures } from "../scoring"
import { parseToken } from "../degrees"

const seeds = [17, 97, 301, 1009, 8191]
const patterns = ["i-bVI-bVII-bIII", "i-iv-bVII-bIII", "i-iv-V-i", "i-bVI-iv-V"]

function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function summary(rows: { tokens: string[]; score: number }[]) {
  const skeletons = rows.map((row) => rootSkeletonOf(row.tokens))
  return {
    count: rows.length,
    uniqueSkeletons: new Set(skeletons).size,
    meanScore: rows.reduce((sum, row) => sum + row.score, 0) / rows.length,
    patterns: Object.fromEntries(patterns.map((pattern) => {
      const tokens = pattern.split("-")
      const rotations = tokens.map((_, i) => [...tokens.slice(i), ...tokens.slice(0, i)].join("-"))
      return [pattern, {
        orderedRate: skeletons.filter((skeleton) => skeleton === pattern).length / rows.length,
        cyclicRate: skeletons.filter((skeleton) => rotations.includes(skeleton)).length / rows.length,
      }]
    })),
  }
}

it.skipIf(!process.env.CHORD_DISTRIBUTION_PATH)("measures fixed-seed raw and selected distributions", () => {
  const output: unknown[] = []
  const originalRandom = Math.random
  try {
    for (const { value: style } of STYLE_OPTIONS) {
      for (const mode of ["minor", "major"] as const) {
        const raw: { tokens: string[]; score: number }[] = []
        const selected: { tokens: string[]; score: number }[] = []
        const perSeed: unknown[] = []
        for (const seed of seeds) {
          vi.spyOn(Math, "random").mockImplementation(random(seed))
          for (let i = 0; i < 200; i++) {
            const tokens = generateChain(style, mode, "melancholic", 4)
            raw.push({ tokens, score: computeScores(extractFeatures(tokens.map(parseToken), mode)).boutonnat })
          }
          vi.spyOn(Math, "random").mockImplementation(random(seed))
          clearSessionSkeletonHistory()
          const start = selected.length
          for (let i = 0; i < 40; i++) {
            for (const p of generateProgressions({ key: { tonic: "A", mode }, style, section: "chorus", mood: "melancholic", count: 5, length: 4 })) {
              selected.push({ tokens: p.romanNumerals, score: p.scores.boutonnat })
            }
          }
          perSeed.push({ seed, selected: summary(selected.slice(start)) })
        }
        expect(selected.length).toBeGreaterThan(0)
        output.push({ style, mode, raw: summary(raw), selected: summary(selected), perSeed })
      }
    }
    writeFileSync(process.env.CHORD_DISTRIBUTION_PATH!, JSON.stringify({
      conditions: { seeds, callsPerSeed: 40, count: 5, length: 4, tonic: "A", section: "chorus", mood: "melancholic", history: "cleared per seed, retained between calls" },
      continuationEvidence: Object.fromEntries(["i", "iv", "bVI", "bVII"].map((t) => [t, continuationsOf("romanticDark", "minor", t)])),
      output,
    }, null, 2) + "\n")
  } finally {
    Math.random = originalRandom
    vi.restoreAllMocks()
    clearSessionSkeletonHistory()
  }
}, 120000)
