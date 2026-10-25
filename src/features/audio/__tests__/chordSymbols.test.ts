import { describe, it, expect } from "vitest"
import { parseChordSymbol } from "../chordSymbols"

describe("parseChordSymbol", () => {
  it("パワーコードは根音と5度だけを鳴らす", () => {
    const voicing = parseChordSymbol("D5")!
    expect(voicing.notes.map((n) => n % 12)).toEqual([2, 9])
    expect(voicing.bass % 12).toBe(2)
  })

  it("7(♭9)は短9度を含む5音を鳴らす", () => {
    const voicing = parseChordSymbol("A7b9")!
    expect(voicing.notes.map((n) => n % 12)).toEqual([9, 1, 4, 7, 10])
  })
})
