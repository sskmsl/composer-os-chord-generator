import { describe, expect, it } from "vitest"
import { continuationsOf } from "../transitions"

describe("transition roots", () => {
  it("keeps minor tonic, subdominant and flattened upper degrees separate", () => {
    const next = (token: string) => continuationsOf("romanticDark", "minor", token)
    expect(next("i")).not.toEqual(next("iv"))
    expect(next("bVI")).not.toEqual(next("bVII"))
    expect(next("i")).toContain("#ivdim")
    expect(next("iv")).not.toContain("#ivdim")
    expect(next("iv")).toContain("bIIImaj7")
    expect(next("bVII")).toEqual(["bVI"])
  })

  it("keeps major tonic, subdominant and submediant separate", () => {
    const next = (token: string) => continuationsOf("newWave", "major", token)
    expect(next("I")).not.toEqual(next("IV"))
    expect(next("V")).not.toEqual(next("vi"))
    expect(next("IV")).toContain("vi")
    expect(next("I")).toContain("iii")
    expect(next("IV")).not.toContain("iii")
  })

  it("ignores color, parentheses and slash bass while retaining the complete degree", () => {
    for (const [root, token] of [["iv", "ivm9/bVI"], ["i", "i(add9)/bVII"], ["bVI", "bVImaj7/i"], ["bVII", "bVIIsus2/V"]]) {
      expect(continuationsOf("romanticDark", "minor", token)).toEqual(continuationsOf("romanticDark", "minor", root))
    }
  })
})
