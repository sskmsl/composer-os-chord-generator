import { describe, expect, it } from "vitest"
import { MAJOR_KEYS, MINOR_KEYS, keyLabel, type MusicKey } from "@/types/music"
import { chordName, NOTE_TO_PC, parseToken } from "../degrees"
import { resolveKeyMove, rotateLoop } from "../songFlow"

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
