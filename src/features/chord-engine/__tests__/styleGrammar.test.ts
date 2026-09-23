import { describe, it, expect } from "vitest"
import type { Mode, SectionId, StyleId } from "@/types/music"
import { parseToken } from "../degrees"
import { clearSessionSkeletonHistory, generateProgressions, rootSkeletonOf } from "../generateProgressions"
import { commonToneSubstitutes, matchesStyleSignature, rootKey, styleVocabulary } from "../styleGrammar"
import { STYLE_OPTIONS, STYLE_TEMPLATES } from "../templates"

const MODES: Mode[] = ["minor", "major"]
const SECTIONS: SectionId[] = [
  "intro",
  "verse",
  "pre-chorus",
  "chorus",
  "breakdown-chorus",
  "grand-chorus",
  "c-melody",
  "bridge",
  "instrumental",
  "outro",
]

function generateAll(style: StyleId, mode: Mode) {
  return SECTIONS.flatMap((section) =>
    generateProgressions({ key: { tonic: "A", mode }, style, section, mood: "melancholic", count: 5 }),
  )
}

describe("style signatures", () => {
  it("every hand-written template satisfies its own style's signature", () => {
    for (const { value: style } of STYLE_OPTIONS) {
      for (const mode of MODES) {
        for (const template of STYLE_TEMPLATES[style][mode]) {
          expect(matchesStyleSignature(style, template.map(parseToken), mode), `${style} ${mode}: ${template.join(" ")}`).toBe(
            true,
          )
        }
      }
    }
  })
})

describe("style fidelity of generated progressions", () => {
  it("never uses a root or color outside the style's own vocabulary, in any section", () => {
    for (const { value: style } of STYLE_OPTIONS) {
      for (const mode of MODES) {
        const vocab = styleVocabulary(style, mode)
        for (const p of generateAll(style, mode)) {
          for (const token of p.romanNumerals) {
            expect(vocab.roots.has(rootKey(token)), `${style} ${mode} ${p.section}: ${token}`).toBe(true)
            expect(vocab.suffixes.has(parseToken(token).suffix), `${style} ${mode} ${p.section}: ${token}`).toBe(true)
          }
        }
      }
    }
  })

  it("every generated progression carries its style's signature", () => {
    for (const { value: style } of STYLE_OPTIONS) {
      for (const mode of MODES) {
        for (const p of generateAll(style, mode)) {
          expect(matchesStyleSignature(style, p.romanNumerals.map(parseToken), mode), `${style} ${mode}: ${p.romanNumerals.join(" ")}`).toBe(
            true,
          )
        }
      }
    }
  })

  it("regression: section rules no longer inject a major V into modal styles (Dorian / Trip-Hop / Ritual / Minimalism)", () => {
    // 以前はBメロ末尾にV/Vsus4/V7sus4を全スタイル共通で差し込んでいた
    for (const style of ["dorian", "tripHop", "ritual", "minimalism"] as StyleId[]) {
      for (const p of generateAll(style, "minor")) {
        expect(p.romanNumerals.some((t) => rootKey(t) === "V"), `${style}: ${p.romanNumerals.join(" ")}`).toBe(false)
      }
    }
  })

  it("never repeats the same chord three times in a row", () => {
    for (const { value: style } of STYLE_OPTIONS) {
      for (const p of generateAll(style, "minor")) {
        const roots = p.romanNumerals.map(rootKey)
        for (let i = 2; i < roots.length; i++) {
          const tripled = roots[i] === roots[i - 1] && roots[i - 1] === roots[i - 2]
          // Outroの「反復とフェード」だけは意図的に同じ和音へ戻す
          if (p.section !== "outro") expect(tripled, `${style}: ${p.romanNumerals.join(" ")}`).toBe(false)
        }
      }
    }
  })
})

describe("new styles", () => {
  it("Electronica stays on 7th/9th pads and avoids the dominant V", () => {
    for (const mode of MODES) {
      for (const p of generateAll("electronica", mode)) {
        const parsed = p.romanNumerals.map(parseToken)
        expect(parsed.some((c) => rootKey(c.token) === "V")).toBe(false)
        const pads = parsed.filter((c) => ["maj7", "m9", "m11", "7", "11"].includes(c.suffix)).length
        expect(pads / parsed.length).toBeGreaterThanOrEqual(0.5)
      }
    }
  })

  it("Sadcore / Slowcore keeps plain triads and no 7th chords", () => {
    for (const mode of MODES) {
      for (const p of generateAll("slowcore", mode)) {
        const parsed = p.romanNumerals.map(parseToken)
        expect(parsed.some((c) => ["maj7", "m9", "m11", "7", "11", "6"].includes(c.suffix))).toBe(false)
        expect(parsed.filter((c) => c.suffix !== "").length).toBeLessThanOrEqual(1)
      }
    }
  })

  it("French Pop always has a dominant-seventh pull (V7 / secondary dominant) or a half-diminished ii", () => {
    for (const mode of MODES) {
      for (const p of generateAll("frenchPop", mode)) {
        const parsed = p.romanNumerals.map(parseToken)
        expect(parsed.some((c) => (!c.lower && c.suffix === "7") || c.suffix === "ø"), p.romanNumerals.join(" ")).toBe(true)
      }
    }
  })
})

describe("歌謡曲 (kayokyoku)", () => {
  it("always has a dominant pull (V / dominant seventh) or a descending-fifths chain, with no modern colors", () => {
    for (const mode of MODES) {
      for (const p of generateAll("kayokyoku", mode)) {
        const parsed = p.romanNumerals.map(parseToken)
        expect(parsed.every((c) => ["", "7", "6", "maj7", "ø", "sus4", "7sus4"].includes(c.suffix)), p.romanNumerals.join(" ")).toBe(true)
        expect(matchesStyleSignature("kayokyoku", parsed, mode)).toBe(true)
      }
    }
  })
})

describe("骨格の重複対策(数百曲を前提)", () => {
  it("代理和音は同じスタイルの語彙で、根音が違い、基本の3音を2つ以上共有する", () => {
    const vocab = styleVocabulary("romanticDark", "minor")
    const subs = commonToneSubstitutes("romanticDark", "minor", "i")
    expect(subs.length).toBeGreaterThan(0)
    for (const t of subs) {
      expect(rootKey(t)).not.toBe("i")
      expect(vocab.roots.has(rootKey(t))).toBe(true)
    }
    // i(A C E) と bIII(C E G)・bVI(F A C) は2音を共有する代理和音
    expect(subs.map(rootKey)).toEqual(expect.arrayContaining(["bIII", "bVI"]))
  })

  it("曲集で使った骨格を渡すと、別セッションで繰り返し作っても骨格が分散する", () => {
    const library: string[] = []
    for (let i = 0; i < 60; i++) {
      clearSessionSkeletonHistory()
      const [top] = generateProgressions({
        key: { tonic: "A", mode: "minor" },
        style: "romanticDark",
        section: "chorus",
        mood: "melancholic",
        count: 5,
        usedSkeletons: new Set(library),
      })
      library.push(rootSkeletonOf(top.romanNumerals))
    }
    // 計測では60曲中およそ55種類。履歴なしでは200曲で平均82種類(1割前後が同じ骨格)だった
    expect(new Set(library).size).toBeGreaterThanOrEqual(45)
  })
})

describe("8小節フレーズ(問いと答え)", () => {
  const period = (style: StyleId, section: SectionId, mode: Mode = "minor") =>
    generateProgressions({ key: { tonic: "A", mode }, style, section, mood: "melancholic", count: 5, length: 8 })

  it("8和音・各1小節で、後半は前半と同じ出だし2和音で始まる", () => {
    for (const { value: style } of STYLE_OPTIONS) {
      for (const p of period(style, "chorus")) {
        expect(p.chords).toHaveLength(8)
        expect(p.beats).toEqual([4, 4, 4, 4, 4, 4, 4, 4])
        const roots = p.romanNumerals.map(rootKey)
        expect([roots[4], roots[5]], `${style}: ${p.romanNumerals.join(" ")}`).toEqual([roots[0], roots[1]])
      }
    }
  })

  it("前半は次へ向かう和音で止め(問い)、サビでは後半がトニックへ着地する(答え)", () => {
    for (const { value: style } of STYLE_OPTIONS) {
      for (const mode of MODES) {
        const tonic = mode === "minor" ? "i" : "I"
        for (const p of period(style, "chorus", mode)) {
          const roots = p.romanNumerals.map(rootKey)
          expect(roots[3], `${style} ${mode}: ${p.romanNumerals.join(" ")}`).not.toBe(tonic)
          expect(roots[7], `${style} ${mode}: ${p.romanNumerals.join(" ")}`).toBe(tonic)
        }
      }
    }
  })

  it("Bメロでは後半も解決させずに次のセクションへつなぐ", () => {
    for (const p of period("romanticDark", "pre-chorus")) {
      expect(rootKey(p.romanNumerals[7])).not.toBe("i")
    }
  })

  it("前半・後半それぞれがスタイルのシグネチャーを満たす", () => {
    for (const { value: style } of STYLE_OPTIONS) {
      for (const p of period(style, "verse")) {
        const parsed = p.romanNumerals.map(parseToken)
        expect(matchesStyleSignature(style, parsed.slice(0, 4), "minor"), `${style}: ${p.romanNumerals.join(" ")}`).toBe(true)
        expect(matchesStyleSignature(style, parsed.slice(4), "minor"), `${style}: ${p.romanNumerals.join(" ")}`).toBe(true)
      }
    }
  })
})
