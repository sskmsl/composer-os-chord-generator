import { expect, it, vi } from "vitest"
import { clearSessionSkeletonHistory, generateProgressions, rootSkeletonOf } from "../generateProgressions"

it.each([17, 97, 301, 1009, 8191])("preserves the existing library diversity requirement with seed %i", (seed) => {
  let state = seed >>> 0
  vi.spyOn(Math, "random").mockImplementation(() => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  })
  try {
    const library: string[] = []
    for (let i = 0; i < 60; i++) {
      clearSessionSkeletonHistory()
      const [top] = generateProgressions({ key: { tonic: "A", mode: "minor" }, style: "romanticDark", section: "chorus", mood: "melancholic", count: 5, usedSkeletons: new Set(library) })
      library.push(rootSkeletonOf(top.romanNumerals))
    }
    expect(new Set(library).size).toBeGreaterThanOrEqual(45)
  } finally {
    vi.restoreAllMocks()
    clearSessionSkeletonHistory()
  }
})
