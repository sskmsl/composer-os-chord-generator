import { describe, it, expect } from "vitest"
import { clearSessionSkeletonHistory, generateProgressions } from "@/features/chord-engine/generateProgressions"
import {
  learnPreference,
  MIN_SAVES_FOR_PREFERENCE,
  preferenceBonus,
  type FeedbackRecord,
} from "../preferenceModel"

function record(i: number, tags: string[], saved: boolean): FeedbackRecord {
  return { id: `r${i}`, at: new Date(2026, 0, 1, 0, i).toISOString(), style: "romanticDark", mode: "minor", tags, saved }
}

/** ペダルのある候補ほど保存される人の記録: ペダルあり 60件中40件保存、ペダルなし 140件中10件保存 */
function pedalLoverRecords(): FeedbackRecord[] {
  const records: FeedbackRecord[] = []
  for (let i = 0; i < 60; i++) records.push(record(i, ["pedal", "cadence:modal"], i < 40))
  for (let i = 60; i < 200; i++) records.push(record(i, ["plain", "cadence:authentic"], i < 70))
  return records
}

describe("learnPreference", () => {
  it("保存が一定数に届くまでは学習しない(偶然の偏りを拾わない)", () => {
    const few = Array.from({ length: MIN_SAVES_FOR_PREFERENCE - 1 }, (_, i) => record(i, ["pedal"], true))
    expect(learnPreference(few)).toBeNull()
  })

  it("保存されやすい特徴は正、されにくい特徴は負の重みになる", () => {
    const model = learnPreference(pedalLoverRecords())!
    expect(model.savedCount).toBe(50)
    expect(model.weights.pedal).toBeGreaterThan(0.5)
    expect(model.weights.plain).toBeLessThan(-0.5)
  })

  it("補正値は -2〜+2 に収まる", () => {
    const model = { weights: { a: 1, b: 1, c: 1, d: -1, e: -1, f: -1 }, savedCount: 40 }
    expect(preferenceBonus(model, ["a", "b", "c"])).toBe(2)
    expect(preferenceBonus(model, ["d", "e", "f"])).toBe(-2)
    expect(preferenceBonus(null, ["a"])).toBe(0)
  })
})

describe("好みの順位への反映", () => {
  it("好みの特徴を持つ候補が上位に選ばれやすくなる(表示する点数は変えない)", () => {
    const model = { weights: { pedal: 1, slash: 1 }, savedCount: 40 }
    const share = (preference: typeof model | null) => {
      let hit = 0
      let n = 0
      for (let i = 0; i < 30; i++) {
        clearSessionSkeletonHistory()
        for (const p of generateProgressions({
          key: { tonic: "A", mode: "minor" },
          style: "romanticDark",
          section: "chorus",
          mood: "melancholic",
          count: 5,
          preference,
        })) {
          n++
          if (p.featureTags?.some((t) => t === "pedal" || t === "slash")) hit++
        }
      }
      return hit / n
    }
    // 計測では 60% → 82% 程度
    expect(share(model)).toBeGreaterThan(share(null) + 0.08)
  })
})
