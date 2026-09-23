import { afterEach, describe, it, expect, vi } from "vitest"
import { parseToken } from "../degrees"
import { applyVoiceLeadingBass } from "../voiceLeading"

afterEach(() => {
  vi.restoreAllMocks()
})

/** chance() は Math.random() < prob で判定される。0 を返せば常に true 扱いになる。 */
function alwaysChance() {
  vi.spyOn(Math, "random").mockReturnValue(0)
}

describe("applyVoiceLeadingBass", () => {
  it("never assigns a bass to the first or last chord, even when every interior choice improves", () => {
    alwaysChance()
    const chords = ["i", "iv", "V", "i"].map(parseToken)
    const { chords: result, invertedIndices } = applyVoiceLeadingBass(chords, "romanticDark")
    expect(result[0].bass).toBeUndefined()
    expect(result[result.length - 1].bass).toBeUndefined()
    for (const i of invertedIndices) {
      expect(i).toBeGreaterThan(0)
      expect(i).toBeLessThan(result.length - 1)
    }
  })

  it("chooses the nearest-neighbor inversion cascading from the (possibly already inverted) previous bass", () => {
    alwaysChance()
    const chords = ["i", "iv", "V", "i"].map(parseToken)
    const { chords: result, invertedIndices } = applyVoiceLeadingBass(chords, "romanticDark")

    // iv の5度(相対pc 0)が i のベース(相対pc 0)と一致 -> iv/i のトニックペダルが選ばれる
    expect(invertedIndices.has(1)).toBe(true)
    expect(result[1].bass).toMatchObject({ acc: 0, roman: "I" })

    // 直前の(転回済みの) iv/i のベース(pc 0)から見て、V の7th(=導音, 相対pc 11)が最も近い
    expect(invertedIndices.has(2)).toBe(true)
    expect(result[2].bass).toMatchObject({ acc: 0, roman: "VII" })
  })

  it("does not invert when the root position is already the closest option", () => {
    alwaysChance()
    const chords = ["i", "i", "i", "i"].map(parseToken)
    const { chords: result, invertedIndices } = applyVoiceLeadingBass(chords, "romanticDark")
    expect(invertedIndices.size).toBe(0)
    expect(result[1].bass).toBeUndefined()
    expect(result[2].bass).toBeUndefined()
  })

  it("skips dim/ø/aug chords even when an inversion would clearly help", () => {
    alwaysChance()
    const chords = ["i", "Vdim", "i", "i"].map(parseToken)
    const { chords: result, invertedIndices } = applyVoiceLeadingBass(chords, "romanticDark")
    expect(invertedIndices.has(1)).toBe(false)
    expect(result[1].bass).toBeUndefined()
  })

  it("leaves a chord that already carries an explicit slash bass untouched", () => {
    alwaysChance()
    const chords = ["i", "bVImaj7/i", "i", "i"].map(parseToken)
    const { chords: result, invertedIndices } = applyVoiceLeadingBass(chords, "romanticDark")
    expect(invertedIndices.has(1)).toBe(false)
    expect(result[1].bass).toMatchObject({ acc: 0, roman: "I", raw: "i" })
  })

  it("never inverts when chance() rolls false", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999)
    const chords = ["i", "iv", "V", "i"].map(parseToken)
    const { invertedIndices } = applyVoiceLeadingBass(chords, "romanticDark")
    expect(invertedIndices.size).toBe(0)
  })
})
