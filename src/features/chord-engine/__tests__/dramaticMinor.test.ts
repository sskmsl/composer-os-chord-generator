import { afterEach, describe, expect, it, vi } from "vitest"
import { clearSessionSkeletonHistory, generateProgressions, limitDefiniteDominants, rootSkeletonOf } from "../generateProgressions"
import { SEEDS, withSeed } from "./seeded"
import { parseToken } from "../degrees"
import { isDefiniteMajorV, matchesStyleSignature, rootKey, styleVocabulary } from "../styleGrammar"
import { STYLE_OPTIONS, STYLE_TEMPLATES } from "../templates"
import type { MusicKey, SectionId, StyleId } from "@/types/music"

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

describe("definite major V cap in minor", () => {
  const SECTIONS: SectionId[] = [
    "intro", "verse", "pre-chorus", "chorus", "breakdown-chorus", "grand-chorus", "c-melody", "bridge", "instrumental", "outro",
  ]
  const MODAL: StyleId[] = ["dorian", "ritual", "electronica", "slowcore", "tripHop", "minimalism"]
  const ALL_STYLES = STYLE_OPTIONS.map((s) => s.value)
  const definiteCount = (tokens: string[]) => tokens.map(parseToken).filter(isDefiniteMajorV).length

  it("does not count sus chords, which have no major third", () => {
    expect(["V", "V7", "V11", "Vaug"].map((t) => isDefiniteMajorV(parseToken(t)))).toEqual([true, true, true, true])
    expect(["Vsus4", "V7sus4", "Vsus2", "v", "bVII", "bV", "IV"].map((t) => isDefiniteMajorV(parseToken(t)))).toEqual(
      [false, false, false, false, false, false, false],
    )
  })

  it("keeps only the last definite V and softens the earlier ones", () => {
    const chords = ["i", "V7", "bVI", "V", "i", "V7sus4"].map(parseToken)
    const limited = limitDefiniteDominants(chords, "romanticDark", "minor")
    expect(limited.filter(isDefiniteMajorV)).toHaveLength(1)
    expect(limited[3].token).toBe("V")
    expect(limited[1].roman).toBe("V")
    expect(limited[5].token).toBe("V7sus4")
  })

  it("leaves a progression with one definite V, or in major, as it is", () => {
    const one = ["i", "bVI", "V7", "i"].map(parseToken)
    expect(limitDefiniteDominants(one, "finale", "minor")).toEqual(one)
    const major = ["I", "V", "vi", "V7"].map(parseToken)
    expect(limitDefiniteDominants(major, "finale", "major")).toEqual(major)
  })

  it("replaces an extra V with a chord from the style vocabulary, never with a new V", () => {
    const chords = ["i", "V7", "bVI", "V7"].map(parseToken)
    const limited = limitDefiniteDominants(chords, "hiNRG", "minor")
    const vocab = styleVocabulary("hiNRG", "minor")
    for (const c of limited) expect(vocab.roots.has(rootKey(c.token))).toBe(true)
    expect(limited.filter(isDefiniteMajorV)).toHaveLength(1)
  })

  it.each(SEEDS)("holds the cap for every style, section and 4/8-chord length (seed %i)", (seed) => {
    withSeed(seed, () => {
      for (const style of ALL_STYLES) {
        for (const section of SECTIONS) {
          for (const length of [4, 8] as const) {
            for (const p of generateProgressions({ key: A_MINOR, style, section, mood: "dramatic", count: 5, length })) {
              expect(definiteCount(p.romanNumerals), `${style} ${section} ${length}: ${p.romanNumerals.join(" ")}`).toBeLessThanOrEqual(1)
            }
          }
        }
      }
    })
  })

  it.each(SEEDS)("injects no V into modal styles (seed %i)", (seed) => {
    withSeed(seed, () => {
      for (const style of MODAL) {
        for (const section of SECTIONS) {
          for (const p of generateProgressions({ key: A_MINOR, style, section, mood: "dramatic", count: 5, length: 4 })) {
            expect(p.romanNumerals.map(rootKey), `${style} ${section}`).not.toContain("V")
          }
        }
      }
    })
  })
})
