import { describe, expect, it } from "vitest"
import { MAJOR_KEYS, MINOR_KEYS, keyLabel, type MusicKey } from "@/types/music"
import { resolveKeyMove } from "../songFlow"

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
