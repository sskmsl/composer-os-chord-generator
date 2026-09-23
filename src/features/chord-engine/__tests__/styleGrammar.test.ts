import { describe, it, expect } from "vitest"
import type { Mode, SectionId, StyleId } from "@/types/music"
import { parseToken } from "../degrees"
import { generateProgressions } from "../generateProgressions"
import { matchesStyleSignature, rootKey, styleVocabulary } from "../styleGrammar"
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
