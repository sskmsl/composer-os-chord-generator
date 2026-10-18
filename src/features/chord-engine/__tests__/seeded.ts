import { vi } from "vitest"
import { clearSessionSkeletonHistory } from "../generateProgressions"

/** 固定seed。Phase 0 の分布測定と同じ5つ */
export const SEEDS = [17, 97, 301, 1009, 8191]

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export function withSeed<T>(seed: number, run: () => T): T {
  vi.spyOn(Math, "random").mockImplementation(seededRandom(seed))
  clearSessionSkeletonHistory()
  try {
    return run()
  } finally {
    vi.restoreAllMocks()
    clearSessionSkeletonHistory()
  }
}
