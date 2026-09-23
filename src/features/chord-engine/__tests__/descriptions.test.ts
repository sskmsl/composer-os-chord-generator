import { describe, it, expect } from "vitest"
import { buildDescription } from "../descriptions"
import { generateProgressions } from "../generateProgressions"
import type { Features } from "../scoring"
import { STYLE_OPTIONS } from "../templates"
import type { MoodId, MusicKey, SectionId, StyleId } from "@/types/music"

const baseFeatures: Features = {
  minor: true,
  hasDim: false,
  hasBII: false,
  hasV7: false,
  hasBVI: false,
  hasBVII: false,
  hasAug: false,
  hasBviBviiTonic: false,
  hasBorrowed: false,
  hasSlash: false,
  colorCount: 0,
  softColorCount: 0,
  descendingBass: false,
  ascendingBass: false,
  pedalBass: false,
  endsOnTonic: true,
  endsUnresolved: false,
  dominantPrep: false,
  largeArc: false,
  commonToneStrength: 0,
  chromaticInnerSteps: 0,
  surpriseCount: 0,
  plainDiatonic: true,
  overDecorated: false,
  cadence: "authentic",
}

describe("buildDescription feature selection", () => {
  it("mentions the mood alone with no highlighted feature phrase", () => {
    const text = buildDescription("romanticDark", "melancholic", "verse", baseFeatures)
    expect(text).toContain("静かな喪失感をたたえながら")
  })

  it("picks at most 2 concrete facts, prioritized (aug before bII before pedal)", () => {
    const f: Features = { ...baseFeatures, hasAug: true, hasBII: true, pedalBass: true }
    const text = buildDescription("romanticDark", "melancholic", "verse", f)
    expect(text).toContain("オーギュメントの浮遊する違和感")
    expect(text).toContain("bII の翳り")
    expect(text).not.toContain("持続するペダルベース")
  })

  it("only mentions chromatic inner motion when it happens at least twice (not a one-off)", () => {
    const once: Features = { ...baseFeatures, chromaticInnerSteps: 1 }
    const twice: Features = { ...baseFeatures, chromaticInnerSteps: 2 }
    expect(buildDescription("cinematic", "dark", "chorus", once)).not.toContain("内声がにじむ")
    expect(buildDescription("cinematic", "dark", "chorus", twice)).toContain("内声がにじむ")
  })

  it("always states exactly the cadence label matching the detected cadence", () => {
    for (const cadence of ["authentic", "half", "deceptive", "plagal", "modal"] as const) {
      const text = buildDescription("cinematic", "dark", "chorus", { ...baseFeatures, cadence })
      expect(text).toContain("終止は")
    }
  })
})

describe("buildDescription regression: no contradictory or redundant resolution language", () => {
  // かつて「解決しない終止」(endsUnresolvedベース)と「終止は完全終止でしっかり着地」
  // (cadenceベース)が同じ文に同居する矛盾があった。終止についての言及は
  // CADENCE_LABELS の一文だけに一本化したので、もうこの語彙自体が存在しないはずである。
  it("never contains the removed 'unresolved ending' phrase", () => {
    const styles: StyleId[] = STYLE_OPTIONS.map((s) => s.value)
    const sections: SectionId[] = [
      "intro", "verse", "pre-chorus", "chorus", "breakdown-chorus",
      "grand-chorus", "c-melody", "bridge", "instrumental", "outro",
    ]
    const moods: MoodId[] = ["melancholic", "mysterious", "dark", "dramatic", "hopeful"]
    const keys: MusicKey[] = [
      { tonic: "A", mode: "minor" },
      { tonic: "C", mode: "major" },
    ]

    let checked = 0
    for (const style of styles) {
      for (const section of sections) {
        for (const mood of moods) {
          for (const key of keys) {
            const results = generateProgressions({ key, style, section, mood, count: 2 })
            for (const r of results) {
              checked++
              expect(r.description).not.toContain("解決しない終止")
              expect(r.description).not.toContain("ドミナントからの確かな解決")
              // 終止句(「終止は」)は必ず1回だけ出現する
              expect(r.description.match(/終止は/g)?.length).toBe(1)
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(500)
  })
})

describe("ムード表現の選び分け", () => {
  it("特徴に結びついた表現は、その特徴を持つ進行でだけ使う", () => {
    for (let i = 0; i < 50; i++) {
      // 特徴の無い進行では既定の表現だけ
      expect(buildDescription("romanticDark", "melancholic", "verse", baseFeatures)).toContain("静かな喪失感")
    }
    const descending = { ...baseFeatures, descendingBass: true, plainDiatonic: false }
    const seen = new Set<string>()
    for (let i = 0; i < 80; i++) {
      const text = buildDescription("romanticDark", "melancholic", "verse", descending)
      for (const phrase of ["静かな喪失感", "少しずつ沈んでいく哀しみ", "言葉にならない未練", "柔らかく滲む切なさ"]) {
        if (text.includes(phrase)) seen.add(phrase)
      }
    }
    // 下降ベースの進行では「沈んでいく」表現が選ばれうるが、未解決・柔らかい色彩の表現は出ない
    expect(seen.has("少しずつ沈んでいく哀しみ")).toBe(true)
    expect(seen.has("言葉にならない未練")).toBe(false)
    expect(seen.has("柔らかく滲む切なさ")).toBe(false)
  })
})
