import { afterEach, describe, expect, it, vi } from "vitest"
import { clearSessionSkeletonHistory, generateProgressions, limitDefiniteDominants, returningHome, reusablePrevious, rotatedChorusLoop, rootSkeletonOf, withHomeReturnTail, type GenerateParams, type PreviousSection } from "../generateProgressions"
import { SEEDS, withSeed } from "./seeded"
import { chordName, parseToken } from "../degrees"
import { resolveKeyMove, rotateLoop, toParallelMinor } from "../songFlow"
import { isDefiniteMajorV, matchesStyleSignature, rootKey, spiceTokens, styleVocabulary } from "../styleGrammar"
import { STYLE_OPTIONS, STYLE_TEMPLATES } from "../templates"
import { keyLabel, MAJOR_KEYS, MINOR_KEYS, type MusicKey, type SectionId, type StyleId } from "@/types/music"

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
    const reusable = { loop: previousLoop, lastRoot, sameKey: true }
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

describe("c-melody and bridge colour", () => {
  const previousLoop = ["bVII", "i", "bIII", "bVI"]
  const F_SHARP_MINOR: MusicKey = { tonic: "F#", mode: "minor" }
  const rotationSkeletons = previousLoop.map((_, i) => rotateLoop(previousLoop, i).join("-"))
  const spiceRoots = new Set(spiceTokens("cinematic", "minor").map(rootKey))
  const hasSpice = (tokens: string[]) => tokens.some((t) => spiceRoots.has(rootKey(t)))
  const collect = (section: SectionId, key: MusicKey, previous?: PreviousSection) =>
    Array.from({ length: 60 }, () =>
      generateProgressions({ key, style: "cinematic", section, mood: "dramatic", count: 5, length: 4, previous }),
    ).flat().map((p) => p.romanNumerals)
  const share = (rows: string[][], test: (tokens: string[]) => boolean) => rows.filter(test).length / rows.length

  it.each(SEEDS)("reuses the previous loop with a colour chord in both sections (seed %i)", (seed) => {
    for (const section of ["c-melody", "bridge"] as const) {
      const control = withSeed(seed, () => collect(section, A_MINOR))
      const reused = withSeed(seed, () => collect(section, A_MINOR, { key: A_MINOR, loop: previousLoop }))
      const isShape = (tokens: string[]) => rotationSkeletons.includes(rootSkeletonOf(tokens))
      expect(share(reused, isShape), section).toBeGreaterThan(share(control, isShape) + 0.05)
      // 前のループの同型として現れる進行には、そのスタイルの色彩和音が必ず入る
      for (const tokens of reused.filter(isShape)) {
        expect(hasSpice(tokens) || tokens.length === 0, `${section}: ${tokens.join(" ")}`).toBe(true)
      }
    }
  })

  it("keeps the previous chords as they are when the key has moved, so the same shape sounds in the new key", () => {
    withSeed(SEEDS[0], () => {
      const reused = collect("bridge", F_SHARP_MINOR, { key: A_MINOR, loop: previousLoop })
      const same = reused.filter((t) => rootSkeletonOf(t) === previousLoop.join("-"))
      expect(same.length).toBeGreaterThan(0)
    })
  })

  it("does not reuse the loop in other sections", () => {
    withSeed(SEEDS[1], () => {
      const control = collect("verse", A_MINOR)
      const withPrevious = collect("verse", A_MINOR, { key: A_MINOR, loop: previousLoop })
      const isShape = (tokens: string[]) => rotationSkeletons.includes(rootSkeletonOf(tokens))
      expect(share(withPrevious, isShape)).toBeLessThan(share(control, isShape) + 0.05)
    })
  })
})

describe("temporary darkening to the parallel minor", () => {
  const majorLoop = ["I", "vi", "IV", "V"]
  const darkLoop = toParallelMinor(majorLoop)
  const darkHead = darkLoop.slice(0, 3).map(rootKey).join("-")
  const generateDark = (original: MusicKey, style: StyleId, section: SectionId, previous: boolean) =>
    generateProgressions({
      key: resolveKeyMove(original, "parallel"),
      style,
      section,
      mood: "dramatic",
      count: 5,
      length: 4,
      previous: previous ? { key: original, loop: majorLoop } : undefined,
      originalKey: original,
    })
  const share = (rows: string[][], test: (tokens: string[]) => boolean) => rows.filter(test).length / rows.length

  it("uses the major loop as parallel-minor borrowed chords in the soft chorus, in all 12 keys", () => {
    for (const original of MAJOR_KEYS) {
      const results = withSeed(SEEDS[0], () =>
        Array.from({ length: 40 }, () => generateDark(original, "cinematic", "breakdown-chorus", true)).flat(),
      )
      const control = withSeed(SEEDS[0], () =>
        Array.from({ length: 40 }, () => generateDark(original, "cinematic", "breakdown-chorus", false)).flat(),
      )
      const isDark = (p: (typeof results)[number]) => p.romanNumerals.slice(0, 3).map(rootKey).join("-") === darkHead
      const found = results.filter(isDark)
      expect(found.length, keyLabel(original)).toBeGreaterThan(control.filter(isDark).length)
      // コード名もその調の同主短調で綴られる
      const dark = resolveKeyMove(original, "parallel")
      for (const p of found) expect(p.chords[0].startsWith(chordName(parseToken("i"), dark).replace(/m.*$/, ""))).toBe(true)
    }
  })

  it.each(SEEDS)("keeps the darkened bridge on the borrowed loop with a colour chord (seed %i)", (seed) => {
    const rows = withSeed(seed, () =>
      Array.from({ length: 60 }, () => generateDark({ tonic: "C", mode: "major" }, "cinematic", "bridge", true)).flat(),
    )
    const control = withSeed(seed, () =>
      Array.from({ length: 60 }, () => generateDark({ tonic: "C", mode: "major" }, "cinematic", "bridge", false)).flat(),
    )
    const isShape = (tokens: string[]) => darkLoop.every((d) => tokens.some((t) => rootKey(t) === rootKey(d)))
    expect(share(rows.map((p) => p.romanNumerals), isShape)).toBeGreaterThan(share(control.map((p) => p.romanNumerals), isShape))
  })

  it("does not apply to a minor song, or to a loop outside the style vocabulary", () => {
    withSeed(SEEDS[1], () => {
      const minorKey: MusicKey = { tonic: "A", mode: "minor" }
      const none = reusablePrevious({ ...baseParams, key: minorKey, previous: { key: minorKey, loop: ["I", "vi", "IV", "V"] } })
      expect(none).toBeNull()
      const outside = reusablePrevious({
        ...baseParams,
        style: "dorian",
        key: { tonic: "C", mode: "minor" },
        previous: { key: { tonic: "C", mode: "major" }, loop: ["Imaj7", "iii7", "IVmaj7", "vi"] },
      })
      expect(outside).toBeNull()
      const darkened = reusablePrevious({ ...baseParams, key: { tonic: "C", mode: "minor" }, previous: { key: { tonic: "C", mode: "major" }, loop: majorLoop } })
      expect(darkened?.darkened).toBe(true)
      expect(darkened?.loop).toEqual(darkLoop)
    })
  })
})

describe("return to the original key", () => {
  const tailRoots = (tokens: string[], mode: MusicKey["mode"]) => tokens.slice(-3).map(rootKey).join("-") === `bVI-bVII-${mode === "minor" ? "i" : "I"}`
  const returning = (original: MusicKey) => ({
    key: original,
    previous: {
      key: resolveKeyMove(original, "relative"),
      loop: original.mode === "minor" ? ["bVII", "i", "bIII", "bVI"] : ["vi", "IV", "I", "V"],
    },
  })
  const generateReturn = (original: MusicKey, section: SectionId, withOriginal: boolean) =>
    generateProgressions({
      style: "cinematic",
      section,
      mood: "dramatic",
      count: 5,
      length: 4,
      ...returning(original),
      originalKey: withOriginal ? original : undefined,
    })
  const tailShare = (original: MusicKey, section: SectionId, withOriginal: boolean) => {
    const rows = Array.from({ length: 40 }, () => generateReturn(original, section, withOriginal)).flat()
    return rows.filter((p) => tailRoots(p.romanNumerals, original.mode)).length / rows.length
  }

  it("is a return only when the key is the original and the previous section was elsewhere", () => {
    const a: MusicKey = { tonic: "A", mode: "minor" }
    const c: MusicKey = { tonic: "C", mode: "major" }
    expect(returningHome({ ...baseParams, key: a, originalKey: a, previous: { key: c, loop: ["I", "V"] } })).toBe(true)
    expect(returningHome({ ...baseParams, key: a, originalKey: a, previous: { key: a, loop: ["i", "bVI"] } })).toBe(false)
    expect(returningHome({ ...baseParams, key: c, originalKey: a, previous: { key: a, loop: ["i", "bVI"] } })).toBe(false)
    expect(returningHome({ ...baseParams, key: a, previous: { key: c, loop: ["I", "V"] } })).toBe(false)
    expect(returningHome({ ...baseParams, key: a, originalKey: a })).toBe(false)
  })

  it("ends on bVI, bVII and the tonic when the style has all three, keeping the length", () => {
    withSeed(SEEDS[0], () => {
      for (const style of ["cinematic", "finale", "newWave", "romanticDark"] as const) {
        const tokens = withHomeReturnTail(["i", "bIII", "iv", "V"], style, "minor")
        expect(tokens, style).toHaveLength(4)
        expect(tokens.slice(-3).map(rootKey), style).toEqual(["bVI", "bVII", "i"])
        expect(tokens[0]).toBe("i")
      }
      // 直前がすでに bVI なら、bVII と主和音だけにして同じ根音を重ねない
      expect(withHomeReturnTail(["bVI", "bIII", "bVI", "iv"], "cinematic", "minor").map(rootKey)).toEqual(["bVI", "bIII", "bVII", "i"])
      expect(withHomeReturnTail(["bVII", "i"], "cinematic", "minor").map(rootKey)).toEqual(["bVII", "i"])
      // bVI または bVII が語彙に無いスタイルは変えない(語彙の外の和音は使わない)
      const dorian = ["i", "IV", "bVII", "i"]
      expect(withHomeReturnTail(dorian, "dorian", "minor")).toEqual(dorian)
    })
  })

  it.each(SEEDS)("raises the share of bVI-bVII-tonic endings for the way home in all 12 minor keys (seed %i)", (seed) => {
    for (const k of MINOR_KEYS) {
      for (const section of ["chorus", "grand-chorus", "outro"] as const) {
        const withOriginal = withSeed(seed, () => tailShare(k, section, true))
        const control = withSeed(seed, () => tailShare(k, section, false))
        expect(withOriginal, `${keyLabel(k)} ${section}`).toBeGreaterThan(control)
      }
    }
  })

  it("works in major too, with the borrowed bVI and bVII", () => {
    for (const k of MAJOR_KEYS) {
      const withOriginal = withSeed(SEEDS[1], () => tailShare(k, "chorus", true))
      const control = withSeed(SEEDS[1], () => tailShare(k, "chorus", false))
      expect(withOriginal, keyLabel(k)).toBeGreaterThan(control)
    }
  })

  it("does not change sections that are not the way home", () => {
    const a: MusicKey = { tonic: "A", mode: "minor" }
    const verses = (withOriginal: boolean) =>
      withSeed(SEEDS[2], () => Array.from({ length: 40 }, () => generateReturn(a, "verse", withOriginal)).flat().map((p) => p.chords))
    expect(verses(true)).toEqual(verses(false))
  })
})
