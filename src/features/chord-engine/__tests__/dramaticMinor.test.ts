import { afterEach, describe, expect, it, vi } from "vitest"
import { clearSessionSkeletonHistory, generateProgressions, limitDefiniteDominants, reusablePrevious, rotatedChorusLoop, rootSkeletonOf, type GenerateParams, type PreviousSection } from "../generateProgressions"
import { SEEDS, withSeed } from "./seeded"
import { chordName, parseToken } from "../degrees"
import { rotateLoop } from "../songFlow"
import { isDefiniteMajorV, matchesStyleSignature, rootKey, styleVocabulary } from "../styleGrammar"
import { STYLE_OPTIONS, STYLE_TEMPLATES } from "../templates"
import { keyLabel, MINOR_KEYS, type MusicKey, type SectionId, type StyleId } from "@/types/music"

afterEach(() => {
  vi.restoreAllMocks()
  clearSessionSkeletonHistory()
})

const A_MINOR: MusicKey = { tonic: "A", mode: "minor" }
const baseParams: GenerateParams = { key: A_MINOR, style: "cinematic", section: "chorus", mood: "dramatic", count: 5 }

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

describe("chorus loop rotation", () => {
  // 遷移表から自然には出にくい並びにして、回転によるものと偶然の一致を見分けやすくする
  const previousLoop = ["bVII", "i", "bIII", "bVI"]
  const lastRoot = "bVI"
  const rotationSkeletons = previousLoop.map((_, i) => rotateLoop(previousLoop, i).join("-"))
  const isReused = (tokens: string[]) => rotationSkeletons.includes(rootSkeletonOf(tokens))
  const previousFor = (key: MusicKey): PreviousSection => ({ key, loop: previousLoop })
  const generateAs = (section: SectionId, key: MusicKey, previous?: PreviousSection) =>
    generateProgressions({ key, style: "cinematic", section, mood: "dramatic", count: 5, length: 4, previous })
  const reuseRate = (section: SectionId, previous?: PreviousSection) => {
    let total = 0
    let reused = 0
    for (let i = 0; i < 60; i++) {
      for (const p of generateAs(section, A_MINOR, previous)) {
        total++
        if (isReused(p.romanNumerals)) reused++
      }
    }
    return reused / total
  }

  it("rotates to a start that differs from both the old start and the previous last chord", () => {
    const reusable = reusablePrevious({ ...baseParams, previous: previousFor(A_MINOR) })
    expect(reusable).not.toBeNull()
    withSeed(SEEDS[0], () => {
      const starts = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const rotated = rotatedChorusLoop(reusable!)
        expect(isReused(rotated)).toBe(true)
        expect(rootKey(rotated[0])).not.toBe(lastRoot)
        expect(rootKey(rotated[0])).not.toBe(rootKey(previousLoop[0]))
        starts.add(rotated[0])
      }
      expect(starts).toEqual(new Set(["i", "bIII"]))
    })
  })

  it("gives the rotated chords in all 12 minor keys", () => {
    const reusable = { loop: previousLoop, lastRoot }
    for (const k of MINOR_KEYS) {
      withSeed(SEEDS[1], () => {
        const rotated = rotatedChorusLoop(reusable)
        const offset = previousLoop.indexOf(rotated[0])
        const names = previousLoop.map((t) => chordName(parseToken(t), k))
        expect(rotated.map((t) => chordName(parseToken(t), k)), keyLabel(k)).toEqual(rotateLoop(names, offset))
      })
    }
  })

  it.each(SEEDS)("raises the share of reused loops only in the chorus (seed %i)", (seed) => {
    const run = (section: SectionId, previous?: PreviousSection) => withSeed(seed, () => reuseRate(section, previous))
    const control = run("chorus")
    expect(run("chorus", previousFor(A_MINOR))).toBeGreaterThan(control + 0.08)
    expect(run("verse", previousFor(A_MINOR))).toBeLessThan(0.08)
  })

  it("ignores a previous loop that does not fit: other mode, other length, or outside the style vocabulary", () => {
    const params = (previous: PreviousSection, length?: number) => ({ ...baseParams, previous, length })
    expect(reusablePrevious(params({ key: { tonic: "C", mode: "major" }, loop: ["I", "vi", "IV", "V"] }))).toBeNull()
    expect(reusablePrevious(params({ key: A_MINOR, loop: ["i", "bVI", "bVII"] }, 4))).toBeNull()
    expect(reusablePrevious(params({ key: A_MINOR, loop: ["i", "v", "bII", "#ivdim"] }))).toBeNull()
    expect(reusablePrevious(params({ key: A_MINOR, loop: ["i"] }))).toBeNull()
    expect(reusablePrevious({ ...baseParams })).toBeNull()
  })

  it("works without previous-section context, as before", () => {
    withSeed(SEEDS[3], () => expect(generateAs("chorus", A_MINOR)).toHaveLength(5))
  })
})

describe("intro endings", () => {
  const generateIntros = (style: StyleId, mode: MusicKey["mode"], rounds = 50) => {
    const key: MusicKey = { tonic: "A", mode }
    return Array.from({ length: rounds }, () =>
      generateProgressions({ key, style, section: "intro", mood: "dramatic", count: 5 }),
    ).flat().map((p) => p.romanNumerals)
  }
  const tonicRoot = (mode: MusicKey["mode"]) => (mode === "minor" ? "i" : "I")
  const endsWithTurnaround = (tokens: string[], mode: MusicKey["mode"]) =>
    tokens.length >= 2 && rootKey(tokens[tokens.length - 2]) === "V" && rootKey(tokens[tokens.length - 1]) === tonicRoot(mode)
  const isRepeating = (tokens: string[]) => tokens.length >= 4 && tokens.every((t, i) => rootKey(t) === rootKey(tokens[i % 2]))

  it.each(SEEDS)("mixes repeat, open and V to i endings in the intro, in minor and major (seed %i)", (seed) => {
    withSeed(seed, () => {
      for (const mode of ["minor", "major"] as const) {
        for (const style of ["cinematic", "finale", "romanticDark", "neoclassical"] as const) {
          const intros = generateIntros(style, mode)
          const repeats = intros.filter(isRepeating).length
          const turnarounds = intros.filter((t) => endsWithTurnaround(t, mode)).length
          const open = intros.filter((t) => rootKey(t[t.length - 1]) !== tonicRoot(mode)).length
          const label = `${style} ${mode}`
          expect(repeats, `${label} repeat`).toBeGreaterThan(0)
          expect(turnarounds, `${label} turnaround`).toBeGreaterThan(0)
          // V→iは「ときどき」: 通常の未解決が主で、ターンアラウンドは少数に留まる
          expect(turnarounds / intros.length, label).toBeLessThan(0.35)
          expect(open / intros.length, label).toBeGreaterThan(0.4)
        }
      }
    })
  })

  it("never leads a modal style to V, and keeps the definite V cap", () => {
    withSeed(SEEDS[0], () => {
      for (const style of ["dorian", "ritual", "electronica", "slowcore", "tripHop", "minimalism"] as const) {
        for (const mode of ["minor", "major"] as const) {
          const introsOfStyle = generateIntros(style, mode, 30)
          for (const tokens of introsOfStyle) {
            expect(endsWithTurnaround(tokens, mode), `${style} ${mode}: ${tokens.join(" ")}`).toBe(false)
          }
        }
      }
      for (const tokens of generateIntros("cinematic", "minor")) {
        expect(tokens.map(parseToken).filter(isDefiniteMajorV).length).toBeLessThanOrEqual(1)
      }
    })
  })

  it("keeps the requested chord count when it repeats or turns around", () => {
    withSeed(SEEDS[1], () => {
      for (const length of [3, 4, 5] as const) {
        for (let i = 0; i < 40; i++) {
          for (const p of generateProgressions({ key: A_MINOR, style: "cinematic", section: "intro", mood: "dramatic", count: 5, length })) {
            expect(p.romanNumerals.length).toBeGreaterThanOrEqual(2)
            expect(p.romanNumerals.length).toBeLessThanOrEqual(length)
          }
        }
      }
    })
  })
})
