import { afterEach, describe, expect, it, vi } from "vitest"
import { clearSessionSkeletonHistory, generateProgressions, rootSkeletonOf } from "../generateProgressions"
import { SEEDS, withSeed } from "./seeded"
import { parseToken } from "../degrees"
import { matchesStyleSignature } from "../styleGrammar"
import { STYLE_OPTIONS, STYLE_TEMPLATES } from "../templates"
import type { MusicKey, StyleId } from "@/types/music"

afterEach(() => {
  vi.restoreAllMocks()
  clearSessionSkeletonHistory()
})

const A_MINOR: MusicKey = { tonic: "A", mode: "minor" }

/** i-bVI-bVII-bIII を、どの和音から始めても同じループとみなして見分ける */
const LOOP = ["i", "bVI", "bVII", "bIII"]
const LOOP_ROTATIONS = LOOP.map((_, i) => [...LOOP.slice(i), ...LOOP.slice(0, i)].join("-"))
const isLoop = (tokens: string[]) => LOOP_ROTATIONS.includes(rootSkeletonOf(tokens))

describe("i-bVI-bVII-bIII templates", () => {
  const holders = STYLE_OPTIONS.map((s) => s.value).filter((style: StyleId) =>
    STYLE_TEMPLATES[style].minor.some(isLoop),
  )

  it("is registered only in cinematic and finale, once each", () => {
    expect(holders.sort()).toEqual(["cinematic", "finale"])
    for (const style of holders) expect(STYLE_TEMPLATES[style].minor.filter(isLoop)).toHaveLength(1)
  })

  it("adds a skeleton that no other template of the style shares", () => {
    for (const style of holders) {
      const added = STYLE_TEMPLATES[style].minor.filter(isLoop).map(rootSkeletonOf)
      const others = STYLE_TEMPLATES[style].minor.filter((tpl) => !isLoop(tpl)).map(rootSkeletonOf)
      expect(others).not.toContain(added[0])
    }
  })

  it("keeps the romantic dark signature strict: the loop alone does not satisfy it", () => {
    expect(matchesStyleSignature("romanticDark", LOOP.map(parseToken), "minor")).toBe(false)
    expect(STYLE_TEMPLATES.romanticDark.minor.some(isLoop)).toBe(false)
  })

  it("satisfies the signature of the styles that hold it", () => {
    for (const style of holders) expect(matchesStyleSignature(style, LOOP.map(parseToken), "minor")).toBe(true)
  })

  it.each(SEEDS)("survives selection only as a small share of the output (seed %i)", (seed) => {
    withSeed(seed, () => {
      for (const style of ["cinematic", "finale"] as const) {
        let total = 0
        let loops = 0
        for (let i = 0; i < 40; i++) {
          for (const p of generateProgressions({ key: A_MINOR, style, section: "chorus", mood: "melancholic", count: 5, length: 4 })) {
            total++
            if (isLoop(p.romanNumerals)) loops++
          }
        }
        expect(loops / total, style).toBeLessThan(0.3)
      }
    })
  })
})
