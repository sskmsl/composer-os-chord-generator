import { describe, it, expect } from "vitest"
import {
  bassPc,
  buildToken,
  chordIntervals,
  chordName,
  chordToneDegree,
  chordPitchClasses,
  degreeForSemitone,
  degreeSemitone,
  parseToken,
  rootPc,
  upperPitchClasses,
} from "../degrees"
import type { MusicKey } from "@/types/music"

const AM: MusicKey = { tonic: "A", mode: "minor" }
const C_MAJ: MusicKey = { tonic: "C", mode: "major" }

describe("parseToken", () => {
  it("parses a plain uppercase roman numeral as a major triad", () => {
    const p = parseToken("V")
    expect(p).toMatchObject({ acc: 0, roman: "V", lower: false, suffix: "" })
  })

  it("parses a plain lowercase roman numeral as a minor triad", () => {
    const p = parseToken("i")
    expect(p).toMatchObject({ acc: 0, roman: "I", lower: true, suffix: "" })
  })

  it("parses accidentals", () => {
    expect(parseToken("bVI")).toMatchObject({ acc: -1, roman: "VI" })
    expect(parseToken("#iv")).toMatchObject({ acc: 1, roman: "IV", lower: true })
  })

  it("parses suffixes including the newly added aug", () => {
    expect(parseToken("V7").suffix).toBe("7")
    expect(parseToken("i(add9)").suffix).toBe("add9")
    expect(parseToken("iiø").suffix).toBe("ø")
    expect(parseToken("Vaug").suffix).toBe("aug")
  })

  it("parses a slash bass", () => {
    const p = parseToken("bVImaj7/i")
    expect(p.bass).toMatchObject({ acc: 0, roman: "I", raw: "i" })
  })

  it("throws on an invalid degree", () => {
    expect(() => parseToken("VIII")).toThrow()
  })

  it("throws on an invalid bass", () => {
    expect(() => parseToken("V/VIII")).toThrow()
  })
})

describe("buildToken", () => {
  it("round-trips through parseToken for a representative sample", () => {
    const samples = [
      "i", "V", "bVI", "#iv", "V7", "i(add9)", "Iadd9", "iiø", "V7sus4",
      "bVImaj7/i", "IVsus2", "Vaug", "i6", "im9",
    ]
    for (const token of samples) {
      const rebuilt = buildToken(parseToken(token))
      expect(parseToken(rebuilt)).toEqual(parseToken(token))
    }
  })
})

describe("chordName", () => {
  it("names a minor tonic in A minor", () => {
    expect(chordName(parseToken("i"), AM)).toBe("Am")
  })

  it("names borrowed chords with flats in a flat-preferring key context via sharp default", () => {
    // Am は FLAT_KEYS に含まれないためシャープ表記
    expect(chordName(parseToken("bVI"), AM)).toBe("F")
    expect(chordName(parseToken("bVII"), AM)).toBe("G")
  })

  it("spells flatted degrees with flats even in a sharp-spelled key (C major bVII is Bb, not A#)", () => {
    expect(chordName(parseToken("bVII"), C_MAJ)).toBe("Bb")
    expect(chordName(parseToken("bIIImaj7"), C_MAJ)).toBe("Ebmaj7")
    expect(chordName(parseToken("bVI"), C_MAJ)).toBe("Ab")
    expect(chordName(parseToken("i/bVII"), AM)).toBe("Am/G")
    // ♯の付いた度数は♯で綴る
    expect(chordName(parseToken("#ivdim"), C_MAJ)).toBe("F#dim")
  })

  it("names extended and altered qualities", () => {
    expect(chordName(parseToken("i(add9)"), AM)).toBe("Am(add9)")
    expect(chordName(parseToken("V7"), AM)).toBe("E7")
    expect(chordName(parseToken("iiø"), C_MAJ)).toBe("Dm7b5")
    expect(chordName(parseToken("Vaug"), C_MAJ)).toBe("Gaug")
    expect(chordName(parseToken("i6"), AM)).toBe("Am6")
  })

  it("names a slash chord", () => {
    expect(chordName(parseToken("bVImaj7/i"), AM)).toBe("Fmaj7/A")
  })
})

describe("chordToneDegree (inversion bass spelling)", () => {
  it("spells the third of E7 in C major as G# (#V), not Ab (bVI)", () => {
    const e7 = parseToken("III7")
    const third = chordToneDegree(e7, 4)
    expect(third).toEqual({ acc: 1, roman: "V" })
    expect(chordName({ ...e7, bass: { ...third, raw: "#v" } }, C_MAJ)).toBe("E7/G#")
  })

  it("keeps flat spellings for tones of flatted chords (bVI in C major: C and Eb)", () => {
    const bVI = parseToken("bVI")
    expect(chordToneDegree(bVI, 4)).toEqual({ acc: 0, roman: "I" })
    expect(chordToneDegree(bVI, 7)).toEqual({ acc: -1, roman: "III" })
  })

  it("spells the third of V7 in A minor as the leading tone G# (VII)", () => {
    expect(chordToneDegree(parseToken("V7"), 4)).toEqual({ acc: 0, roman: "VII" })
  })
})

describe("degreeSemitone", () => {
  it("maps roman numerals to semitones from the tonic", () => {
    expect(degreeSemitone(0, "I")).toBe(0)
    expect(degreeSemitone(0, "V")).toBe(7)
    expect(degreeSemitone(-1, "III")).toBe(3)
    expect(degreeSemitone(1, "IV")).toBe(6)
  })

  it("throws on an unknown roman numeral", () => {
    expect(() => degreeSemitone(0, "VIII")).toThrow()
  })
})

describe("rootPc / bassPc", () => {
  it("computes root pitch class relative to the key tonic", () => {
    expect(rootPc(parseToken("i"), AM)).toBe(9) // A
    expect(rootPc(parseToken("V"), AM)).toBe(4) // E
  })

  it("falls back to the root when there is no slash bass", () => {
    const p = parseToken("i")
    expect(bassPc(p, AM)).toBe(rootPc(p, AM))
  })

  it("uses the slash bass pitch when present", () => {
    const p = parseToken("bVImaj7/i")
    expect(bassPc(p, AM)).toBe(9) // A (トニックペダル)
  })
})

describe("chordIntervals", () => {
  it("returns a major triad by default for uppercase romans", () => {
    expect(chordIntervals(parseToken("V"))).toEqual([0, 4, 7])
  })

  it("returns a minor triad by default for lowercase romans", () => {
    expect(chordIntervals(parseToken("i"))).toEqual([0, 3, 7])
  })

  it("returns the augmented triad intervals", () => {
    expect(chordIntervals(parseToken("Vaug"))).toEqual([0, 4, 8])
  })

  it("distinguishes maj7 on major vs minor degrees (mMaj7 has a minor third)", () => {
    expect(chordIntervals(parseToken("Imaj7"))).toEqual([0, 4, 7, 11])
    expect(chordIntervals(parseToken("imaj7"))).toEqual([0, 3, 7, 11])
  })
})

describe("chordPitchClasses / upperPitchClasses", () => {
  it("includes the slash bass pitch class even when it is not a chord tone", () => {
    // bII/V (Neapolitan over dominant bass) -- V の音(7)はbIIの構成音(1,5,8)に含まれない
    const pcs = chordPitchClasses(parseToken("bII/V"))
    expect(pcs).toContain(7)
  })

  it("excludes the bass pitch class from upperPitchClasses", () => {
    // chordPitchClasses/upperPitchClasses はキーのトニックを 0 とした相対空間で動く
    // (実際の調のtonic pcを使うrootPc/bassPcとは別系統)。bVImaj7/i のベースは
    // 常にトニックペダル(相対 pc = 0)になる。
    const p = parseToken("bVImaj7/i")
    expect(upperPitchClasses(p)).not.toContain(0)
    expect(chordPitchClasses(p)).toContain(0)
  })
})

describe("degreeForSemitone", () => {
  it("prefers the flat spelling used throughout the templates for chromatic degrees", () => {
    expect(degreeForSemitone(1)).toEqual({ acc: -1, roman: "II" }) // bII
    expect(degreeForSemitone(3)).toEqual({ acc: -1, roman: "III" }) // bIII
    expect(degreeForSemitone(8)).toEqual({ acc: -1, roman: "VI" }) // bVI
    expect(degreeForSemitone(10)).toEqual({ acc: -1, roman: "VII" }) // bVII
  })

  it("wraps negative and >=12 inputs into a single octave", () => {
    expect(degreeForSemitone(-1)).toEqual(degreeForSemitone(11))
    expect(degreeForSemitone(12)).toEqual(degreeForSemitone(0))
  })
})
