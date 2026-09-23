import { describe, it, expect } from "vitest"
import { generateProgressions, reanalyzeChords, rootSkeletonOf, transposeProgression } from "../generateProgressions"
import { chordName, parseToken } from "../degrees"
import { STYLE_OPTIONS } from "../templates"
import type { MoodId, MusicKey, SectionId, StyleId } from "@/types/music"

const ALL_STYLES: StyleId[] = STYLE_OPTIONS.map((s) => s.value)
const ALL_SECTIONS: SectionId[] = [
  "intro", "verse", "pre-chorus", "chorus", "breakdown-chorus",
  "grand-chorus", "c-melody", "bridge", "instrumental", "outro",
]
const ALL_MOODS: MoodId[] = [
  "melancholic", "mysterious", "romantic", "dark", "hopeful",
  "dramatic", "floating", "tense", "dance",
]
const KEYS: MusicKey[] = [
  { tonic: "A", mode: "minor" },
  { tonic: "C", mode: "major" },
]

describe("generateProgressions: never throws across the full parameter space", () => {
  it("generates valid, internally consistent progressions for every style x section x mood x key", () => {
    let checked = 0
    for (const style of ALL_STYLES) {
      for (const section of ALL_SECTIONS) {
        for (const mood of ALL_MOODS) {
          for (const key of KEYS) {
            const results = generateProgressions({ key, style, section, mood, count: 2 })
            expect(results.length).toBeGreaterThan(0)
            expect(results.length).toBeLessThanOrEqual(2)
            for (const r of results) {
              checked++
              expect(r.chords.length).toBeGreaterThanOrEqual(2)
              expect(r.romanNumerals.length).toBe(r.chords.length)
              expect(r.beats.length).toBe(r.chords.length)
              for (const b of r.beats) {
                expect(b).toBeGreaterThan(0)
                expect(Number.isInteger(b)).toBe(true)
              }
              // 小節単位: 合計は4拍の倍数で、2拍のコード以外は小節頭から始まる
              expect(r.beats.reduce((a, b) => a + b, 0) % 4).toBe(0)
              let start = 0
              for (const b of r.beats) {
                if (start % 4 !== 0) expect(b).toBe(2)
                start += b
              }
              for (const v of Object.values(r.scores)) {
                expect(v).toBeGreaterThanOrEqual(1)
                expect(v).toBeLessThanOrEqual(10)
              }
              expect(r.description.length).toBeGreaterThan(0)
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000)
  })
})

describe("generateProgressions: output contract", () => {
  it("never returns duplicate chord sequences within a single call", () => {
    const results = generateProgressions({
      key: { tonic: "A", mode: "minor" }, style: "romanticDark", section: "chorus", mood: "melancholic", count: 10,
    })
    const seen = new Set(results.map((r) => r.chords.join("|")))
    expect(seen.size).toBe(results.length)
  })

  it("returns results sorted by descending boutonnat score for a repetitive style (no skeleton penalty applies)", () => {
    // minimalism/tripHop/ritualは骨格反復の抑制対象外なので、純粋にboutonnat降順であることを保証できる
    const results = generateProgressions({
      key: { tonic: "C", mode: "major" }, style: "minimalism", section: "verse", mood: "floating", count: 10,
    })
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].scores.boutonnat).toBeGreaterThanOrEqual(results[i].scores.boutonnat)
    }
  })

  it("keeps a static-rhythm style (minimalism) at a uniform 4 beats per chord", () => {
    const results = generateProgressions({
      key: { tonic: "A", mode: "minor" }, style: "minimalism", section: "verse", mood: "floating", count: 10,
    })
    for (const r of results) {
      expect(r.beats.every((b) => b === 4)).toBe(true)
    }
  })

  it("occasionally varies harmonic rhythm for a non-static style over many samples", () => {
    let sawVariation = false
    for (let i = 0; i < 40 && !sawVariation; i++) {
      const [r] = generateProgressions({
        key: { tonic: "A", mode: "minor" }, style: "neoclassical", section: "chorus", mood: "mysterious", count: 1,
      })
      if (r.beats.some((b) => b !== 4)) sawVariation = true
    }
    expect(sawVariation).toBe(true)
  })
})

describe("rootSkeletonOf", () => {
  it("collapses color/slash differences into the same skeleton", () => {
    expect(rootSkeletonOf(["i", "i(add9)"])).toBe(rootSkeletonOf(["i(add9)", "i"]))
    expect(rootSkeletonOf(["bVImaj7", "bVImaj7/i"])).toBe(rootSkeletonOf(["bVImaj7", "bVImaj7"]))
  })

  it("distinguishes different root motion", () => {
    expect(rootSkeletonOf(["i", "V"])).not.toBe(rootSkeletonOf(["i", "iv"]))
  })

  it("distinguishes major/minor quality of the same degree", () => {
    expect(rootSkeletonOf(["i", "IV"])).not.toBe(rootSkeletonOf(["i", "iv"]))
  })
})

describe("generateProgressions: skeleton repetition suppression", () => {
  it("keeps root-skeleton diversity reasonably high across many separate calls for a non-repetitive style", () => {
    // 同一条件(style×mode)で何度も別々に呼ぶ = 別の曲で同じ設定を使い回すシナリオ。
    // 骨格反復の抑制が効いていれば、count=1を何度呼んでも骨格の使い回しは
    // 一定割合に収まるはず(完全に排除はしない、あくまでランキングへの軽い減点)。
    const skeletons = new Set<string>()
    for (let i = 0; i < 25; i++) {
      const [r] = generateProgressions({
        key: { tonic: "F", mode: "minor" }, style: "hiNRG", section: "chorus", mood: "dance", count: 1,
      })
      skeletons.add(rootSkeletonOf(r.romanNumerals))
    }
    expect(skeletons.size).toBeGreaterThan(5)
  })
})

describe("reanalyzeChords(詳細画面でのコード書き換え)", () => {
  it("生成した進行のコード名から計算し直すと、同じコード名・(ほぼ)同じスコアに戻る", () => {
    let total = 0
    let same = 0
    for (const { value: style } of STYLE_OPTIONS) {
      for (const mode of ["minor", "major"] as const) {
        const key = { tonic: mode === "minor" ? "D" : "Eb", mode }
        for (const p of generateProgressions({ key, style, section: "verse", mood: "melancholic", count: 3 })) {
          const again = reanalyzeChords(p.chords, { key, style, mood: p.mood, section: p.section })
          expect(again, p.chords.join(" ")).not.toBeNull()
          expect(again!.romanNumerals.map((t) => chordName(parseToken(t), key)), `${style}: ${p.chords.join(" ")}`).toEqual(p.chords)
          total++
          if (JSON.stringify(again!.scores) === JSON.stringify(p.scores)) same++
        }
      }
    }
    // コード名だけでは区別できない書き分け(例: 長調の Im9 と im9)があるため、ごく一部は点数が変わり得る
    expect(same / total).toBeGreaterThanOrEqual(0.9)
  })

  it("書き換えたコードに合わせて度数とベースの動きが変わる", () => {
    const key = { tonic: "A", mode: "minor" } as const
    const result = reanalyzeChords(["Am", "Dbmaj7", "E7", "Am"], { key, style: "romanticDark", mood: "melancholic", section: "verse" })
    expect(result?.romanNumerals).toEqual(["i", "IIImaj7", "V7", "i"])
    expect(result?.bassMovement.startsWith("A → Db → E → A")).toBe(true)
  })
})

describe("transposeProgression(保存した進行の移調)", () => {
  it("度数はそのままに、新しい調のコード名とベースの動きへ作り直す", () => {
    const moved = transposeProgression(["i", "bVImaj7", "iv/bVI", "V7"], { tonic: "E", mode: "minor" })
    expect(moved.key).toBe("Em")
    expect(moved.chords).toEqual(["Em", "Cmaj7", "Am/C", "B7"])
    expect(moved.bassMovement.startsWith("E → C → C → B")).toBe(true)
  })
})
