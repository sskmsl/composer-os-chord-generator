import { describe, expect, it } from "vitest"
import { MAJOR_KEYS, MINOR_KEYS, keyLabel, type MusicKey, type StyleId } from "@/types/music"
import { chordName, NOTE_TO_PC, parseToken, rootPc } from "../degrees"
import { relativeMajorDominant } from "../styleGrammar"
import { STYLE_OPTIONS } from "../templates"
import { KEY_DOWN_SEMITONES, NEXT_SECTIONS, resolveKeyMove, rotateLoop, suggestionsFor, toParallelMinor } from "../songFlow"

const key = (tonic: string, mode: MusicKey["mode"]): MusicKey => ({ tonic, mode })

describe("key lists", () => {
  it("list D#m alongside Ebm, and the other common enharmonic spellings", () => {
    const labels = [...MINOR_KEYS, ...MAJOR_KEYS].map(keyLabel)
    for (const label of ["D#m", "Ebm", "A#m", "Bbm", "C#", "Db", "F#", "Gb"]) expect(labels).toContain(label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe("resolveKeyMove", () => {
  it("keeps the source key's sharp/flat spelling when both spellings have the same number of accidentals", () => {
    expect(resolveKeyMove(key("F#", "major"), "relative")).toEqual(key("D#", "minor"))
    expect(resolveKeyMove(key("Gb", "major"), "relative")).toEqual(key("Eb", "minor"))
    expect(resolveKeyMove(key("E", "major"), "up")).toEqual(key("F#", "major"))
    expect(resolveKeyMove(key("Eb", "minor"), "relative")).toEqual(key("Gb", "major"))
    expect(resolveKeyMove(key("D#", "minor"), "relative")).toEqual(key("F#", "major"))
  })

  it("prefers the spelling with fewer accidentals (Db over C#, Bbm over A#m)", () => {
    expect(resolveKeyMove(key("B", "major"), "up")).toEqual(key("Db", "major"))
    expect(resolveKeyMove(key("G#", "minor"), "up")).toEqual(key("Bb", "minor"))
    expect(resolveKeyMove(key("C#", "major"), "relative")).toEqual(key("Bb", "minor"))
  })
})

describe("rotateLoop", () => {
  const loop = ["bVI", "bVII", "i", "bIII"]

  it("starts from another chord and wraps around, for any offset", () => {
    expect(rotateLoop(loop, 0)).toEqual(loop)
    expect(rotateLoop(loop, 1)).toEqual(["bVII", "i", "bIII", "bVI"])
    expect(rotateLoop(loop, 3)).toEqual(["bIII", "bVI", "bVII", "i"])
    expect(rotateLoop(loop, 4)).toEqual(loop)
    expect(rotateLoop(loop, -1)).toEqual(["bIII", "bVI", "bVII", "i"])
    expect(rotateLoop([], 2)).toEqual([])
  })

  it("does not change the source loop", () => {
    const source = [...loop]
    rotateLoop(source, 2)
    expect(source).toEqual(loop)
  })

  it("gives the same chord sequence as rotating the chord names, in all 12 keys and both modes", () => {
    const degrees = ["i(add9)", "bVImaj7", "ivm9", "V7sus4"]
    const majorDegrees = ["I", "vi(add9)", "IVmaj7", "Vsus4"]
    for (const k of [...MINOR_KEYS, ...MAJOR_KEYS]) {
      const tokens = k.mode === "minor" ? degrees : majorDegrees
      const names = tokens.map((t) => chordName(parseToken(t), k))
      for (let offset = 0; offset < tokens.length; offset++) {
        const rotatedNames = rotateLoop(tokens, offset).map((t) => chordName(parseToken(t), k))
        expect(rotatedNames, `${keyLabel(k)} offset ${offset}`).toEqual(rotateLoop(names, offset))
      }
    }
    const pcs = new Set([...MINOR_KEYS, ...MAJOR_KEYS].map((k) => NOTE_TO_PC[k.tonic]))
    expect(pcs.size).toBe(12)
  })

  it("rotates the reference loop Ab–Bb–Eb–Cm into the other starts of the same loop", () => {
    const eb = key("Eb", "major")
    const tokens = ["I", "vi", "IV", "V"]
    expect(tokens.map((t) => chordName(parseToken(t), eb))).toEqual(["Eb", "Cm", "Ab", "Bb"])
    expect(rotateLoop(tokens, 2).map((t) => chordName(parseToken(t), eb))).toEqual(["Ab", "Bb", "Eb", "Cm"])
  })
})

describe("key moves down by 3 semitones and back home", () => {
  const ALL_KEYS = [...MINOR_KEYS, ...MAJOR_KEYS]
  const semitoneDistance = (from: MusicKey, to: MusicKey) => (NOTE_TO_PC[to.tonic] - NOTE_TO_PC[from.tonic] + 12) % 12

  it("is 3 semitones, the same as the reference loop (Ab–Bb–Eb–Cm to F–G–C–Am), not a major third", () => {
    expect(KEY_DOWN_SEMITONES).toBe(3)
    const eb = key("Eb", "major")
    const c = resolveKeyMove(eb, "down")
    expect(c).toEqual(key("C", "major"))
    const loop = ["IV", "V", "I", "vi"]
    expect(loop.map((t) => chordName(parseToken(t), eb))).toEqual(["Ab", "Bb", "Eb", "Cm"])
    expect(loop.map((t) => chordName(parseToken(t), c))).toEqual(["F", "G", "C", "Am"])
  })

  it("moves every one of the 24 listed keys down 3 semitones, keeping the mode", () => {
    for (const k of ALL_KEYS) {
      const moved = resolveKeyMove(k, "down")
      expect(moved.mode, keyLabel(k)).toBe(k.mode)
      expect(semitoneDistance(k, moved), keyLabel(k)).toBe(9)
      expect([...MINOR_KEYS, ...MAJOR_KEYS].some((c) => c.tonic === moved.tonic && c.mode === moved.mode)).toBe(true)
    }
  })

  it("keeps the spelling rules for the moved key", () => {
    expect(resolveKeyMove(key("A", "minor"), "down")).toEqual(key("F#", "minor"))
    expect(resolveKeyMove(key("C", "minor"), "down")).toEqual(key("A", "minor"))
    expect(resolveKeyMove(key("Db", "major"), "down")).toEqual(key("Bb", "major"))
    expect(resolveKeyMove(key("C", "major"), "down")).toEqual(key("A", "major"))
  })

  it("returns to the original key from any moved key, in all 24 keys, and stays when the original is unknown", () => {
    for (const original of ALL_KEYS) {
      for (const move of ["relative", "up", "down"] as const) {
        const moved = resolveKeyMove(original, move)
        expect(resolveKeyMove(moved, "home", original), `${keyLabel(original)} ${move}`).toEqual(original)
      }
      expect(resolveKeyMove(original, "home")).toEqual(original)
    }
  })

  it("is wired into the section suggestions: bridge goes down 3 semitones, and the way back is home", () => {
    expect(NEXT_SECTIONS.chorus.find((s) => s.section === "bridge")?.keyMove?.type).toBe("down")
    expect(NEXT_SECTIONS["c-melody"].find((s) => s.section === "chorus")?.keyMove?.type).toBe("home")
    expect(NEXT_SECTIONS["grand-chorus"].find((s) => s.section === "outro")?.keyMove?.type).toBe("home")
    for (const suggestions of Object.values(NEXT_SECTIONS)) {
      for (const { keyMove } of suggestions) {
        if (keyMove) for (const k of ALL_KEYS) expect(resolveKeyMove(k, keyMove.type, k)).toBeTruthy()
      }
    }
  })
})

describe("temporary darkening to the parallel minor", () => {
  it("moves each of the 12 major keys to the minor on the same tonic, and leaves minor keys as they are", () => {
    for (const k of MAJOR_KEYS) {
      const dark = resolveKeyMove(k, "parallel")
      expect(dark.mode, keyLabel(k)).toBe("minor")
      expect(NOTE_TO_PC[dark.tonic], keyLabel(k)).toBe(NOTE_TO_PC[k.tonic])
      expect(MINOR_KEYS.some((m) => m.tonic === dark.tonic)).toBe(true)
    }
    expect(new Set(MAJOR_KEYS.map((k) => NOTE_TO_PC[k.tonic])).size).toBe(12)
    for (const k of MINOR_KEYS) expect(resolveKeyMove(k, "parallel")).toEqual(k)
    expect(resolveKeyMove(key("C", "major"), "parallel")).toEqual(key("C", "minor"))
    expect(resolveKeyMove(key("Eb", "major"), "parallel")).toEqual(key("Eb", "minor"))
  })

  it("returns to the original major key from the darkened key, in all 12 keys", () => {
    for (const original of MAJOR_KEYS) {
      const dark = resolveKeyMove(original, "parallel")
      expect(resolveKeyMove(dark, "home", original), keyLabel(original)).toEqual(original)
    }
  })

  it("raises the final chorus from the original key, not from the darkened minor", () => {
    for (const original of MAJOR_KEYS) {
      const dark = resolveKeyMove(original, "parallel")
      const up = resolveKeyMove(dark, "up", original)
      expect(up, keyLabel(original)).toEqual(resolveKeyMove(original, "up"))
      expect(up.mode).toBe("major")
    }
    // 暗転していない通常のラスサビ転調は従来どおり、今の調から全音上げる
    expect(resolveKeyMove(key("A", "minor"), "up", key("A", "minor"))).toEqual(key("B", "minor"))
  })

  it("replaces the major loop's degrees with the parallel minor's borrowed chords, in all 12 keys", () => {
    const loop = ["I", "vi", "IV", "V"]
    expect(toParallelMinor(loop)).toEqual(["i", "bVI", "iv", "V"])
    expect(toParallelMinor(["ii7", "iii", "vii", "Imaj7", "IVmaj7", "Vsus4", "bVII", "I/V"])).toEqual(
      ["iiø", "bIII", "bVII", "im9", "ivm9", "Vsus4", "bVII", "i"],
    )
    for (const original of MAJOR_KEYS) {
      const dark = resolveKeyMove(original, "parallel")
      const base = NOTE_TO_PC[original.tonic]
      const darkRoots = toParallelMinor(loop).map((t) => rootPc(parseToken(t), dark))
      // I → 主音、vi → bVI(長調のviより半音下)、IV → 4度、V → 5度
      expect(darkRoots, keyLabel(original)).toEqual([0, 8, 5, 7].map((d) => (base + d) % 12))
    }
  })

  it("is wired into the suggestions: the soft chorus goes dark, and the way back is home", () => {
    expect(NEXT_SECTIONS.chorus.find((s) => s.section === "breakdown-chorus")?.keyMove?.type).toBe("parallel")
    expect(NEXT_SECTIONS["breakdown-chorus"].find((s) => s.section === "chorus")?.keyMove?.type).toBe("home")
  })
})

describe("relative-major chorus suggestions for minor songs", () => {
  const relativeChorus = (section: "verse" | "pre-chorus", k: MusicKey) =>
    suggestionsFor(section, k, "finale").find((s) => s.section === "chorus" && s.keyMove?.type === "relative")

  it("offers a chorus in the relative major from the verse and the pre-chorus, for minor songs only", () => {
    for (const k of MINOR_KEYS) {
      for (const section of ["verse", "pre-chorus"] as const) {
        expect(relativeChorus(section, k), `${keyLabel(k)} ${section}`).toBeTruthy()
      }
    }
    for (const k of MAJOR_KEYS) {
      for (const section of ["verse", "pre-chorus"] as const) expect(relativeChorus(section, k)).toBeUndefined()
    }
  })

  it("keeps the existing suggestions, and adds no new key move type", () => {
    const minor = key("A", "minor")
    expect(suggestionsFor("verse", minor, "finale").map((s) => s.section)).toEqual(["pre-chorus", "pre-chorus", "chorus", "chorus"])
    expect(suggestionsFor("verse", key("C", "major"), "finale").map((s) => s.section)).toEqual(["pre-chorus", "chorus"])
    expect(suggestionsFor("pre-chorus", key("C", "major"), "finale")).toHaveLength(1)
    expect(suggestionsFor("chorus", minor, "cinematic")).toEqual(NEXT_SECTIONS.chorus)
  })

  it("moves each of the 12 minor keys to the relative major, 3 semitones up", () => {
    expect(new Set(MINOR_KEYS.map((k) => NOTE_TO_PC[k.tonic])).size).toBe(12)
    for (const k of MINOR_KEYS) {
      const target = resolveKeyMove(k, relativeChorus("verse", k)!.keyMove!.type)
      expect(target.mode, keyLabel(k)).toBe("major")
      expect((NOTE_TO_PC[target.tonic] - NOTE_TO_PC[k.tonic] + 12) % 12, keyLabel(k)).toBe(3)
    }
    expect(resolveKeyMove(key("B", "minor"), "relative")).toEqual(key("D", "major"))
    expect(resolveKeyMove(key("A", "minor"), "relative")).toEqual(key("C", "major"))
  })
})

describe("the pre-chorus approach is offered only to styles that can end on bVII7", () => {
  const minor = key("A", "minor")
  const approach = (style: StyleId) => suggestionsFor("verse", minor, style).filter((s) => s.approach === "relative")

  it("shows it for the supported styles and hides it for the others, without touching the other suggestions", () => {
    const supported = STYLE_OPTIONS.map((s) => s.value).filter((style) => relativeMajorDominant(style, "minor") !== null)
    const unsupported = STYLE_OPTIONS.map((s) => s.value).filter((style) => relativeMajorDominant(style, "minor") === null)
    expect(supported).toContain("finale")
    expect(unsupported).toEqual(expect.arrayContaining(["cinematic", "ethereal", "newWave", "slowcore"]))
    for (const style of supported) expect(approach(style), style).toHaveLength(1)
    for (const style of unsupported) {
      expect(approach(style), style).toHaveLength(0)
      // 相対長調へ転調するサビの提案は、スタイルに関係なく残る
      expect(suggestionsFor("verse", minor, style).filter((s) => s.keyMove?.type === "relative")).toHaveLength(1)
      expect(suggestionsFor("verse", minor, style).map((s) => s.section)).toEqual(["pre-chorus", "chorus", "chorus"])
    }
  })

  it("is never offered in a major song, whatever the style", () => {
    for (const { value: style } of STYLE_OPTIONS) {
      expect(suggestionsFor("verse", key("C", "major"), style).some((s) => s.approach === "relative")).toBe(false)
    }
  })
})
