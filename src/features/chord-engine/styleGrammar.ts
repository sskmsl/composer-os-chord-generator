import type { Mode, StyleId } from "@/types/music"
import { parseToken } from "./degrees"
import { STYLE_PREFS, STYLE_TEMPLATES } from "./templates"

/**
 * スタイルの「文法」を、そのスタイルの手作りテンプレートと装飾設定だけから導く。
 *
 * セクション変形(Bメロ末尾の緊張、Cメロ・ブリッジの新しい景色、未解決の終止など)は
 * 以前はどのスタイルにも同じ和音(V / V7sus4 / bII / #ivdim / add9 等)を差し込んでいた。
 * そのためDorianにメジャーのV、Trip-HopやMinimalismにドミナント終止が混入し、
 * 出力の約25%がそのスタイルに存在しない和音・装飾を含んでいた。
 * ここではテンプレートの中から役割に合う和音を選ぶので、新しいスタイルも
 * テンプレートと装飾設定を書くだけで、セクション変形がそのスタイルの語彙に収まる。
 */

export interface StyleVocabulary {
  /** 出現しうるルート度数(例: "bVI", "iv", "V") */
  roots: Set<string>
  /** 出現しうる装飾サフィックス(""=素の三和音を含む) */
  suffixes: Set<string>
}

/** トークンのルート度数だけを取り出す(サフィックス・スラッシュベースは無視) */
export function rootKey(token: string): string {
  const p = parseToken(token)
  const acc = p.acc === -1 ? "b" : p.acc === 1 ? "#" : ""
  return `${acc}${p.lower ? p.roman.toLowerCase() : p.roman}`
}

function isTonic(token: string, mode: Mode): boolean {
  return rootKey(token) === (mode === "minor" ? "i" : "I")
}

const memo = new Map<string, unknown>()
function memoized<T>(key: string, build: () => T): T {
  if (!memo.has(key)) memo.set(key, build())
  return memo.get(key) as T
}

function allTokens(style: StyleId, mode: Mode): string[] {
  return STYLE_TEMPLATES[style][mode].flat()
}

/** このスタイル・調で出現してよいルートと装飾(テンプレート+装飾設定) */
export function styleVocabulary(style: StyleId, mode: Mode): StyleVocabulary {
  return memoized(`vocab-${style}-${mode}`, () => {
    const roots = new Set<string>()
    const suffixes = new Set<string>([""])
    for (const token of allTokens(style, mode)) {
      roots.add(rootKey(token))
      suffixes.add(parseToken(token).suffix)
    }
    const prefs = STYLE_PREFS[style]
    for (const c of [...prefs.minorColors, ...prefs.majorColors]) suffixes.add(c)
    return { roots, suffixes }
  })
}

/** トニックの和音(大サビでの着地に使う)。出現頻度がそのまま重みになる */
export function tonicTokens(style: StyleId, mode: Mode): string[] {
  return memoized(`tonic-${style}-${mode}`, () => allTokens(style, mode).filter((t) => isTonic(t, mode)))
}

/**
 * Bメロ末尾・Cメロ末尾に置く「次へ向かう」和音。そのスタイルのテンプレートが
 * 実際に終わりに使っている、トニック以外の和音から選ぶ(Dorianなら IV / bVII、
 * Romantic Darkなら V / V7sus4 のように、スタイルごとに緊張の作り方が変わる)。
 */
export function tensionTokens(style: StyleId, mode: Mode): string[] {
  return memoized(`tension-${style}-${mode}`, () => {
    const endings = STYLE_TEMPLATES[style][mode].map((tpl) => tpl[tpl.length - 1]).filter((t) => !isTonic(t, mode))
    return endings.length > 0 ? endings : allTokens(style, mode).filter((t) => !isTonic(t, mode))
  })
}

/**
 * Cメロ・ブリッジで「新しい景色」を作る和音。そのスタイルのテンプレートで
 * 出現頻度が低い側のルート(=そのスタイルにとっての"毒"や色彩)を持つ和音。
 */
export function spiceTokens(style: StyleId, mode: Mode): string[] {
  return memoized(`spice-${style}-${mode}`, () => {
    const tokens = allTokens(style, mode).filter((t) => !isTonic(t, mode))
    const freq = new Map<string, number>()
    for (const t of tokens) freq.set(rootKey(t), (freq.get(rootKey(t)) ?? 0) + 1)
    const counts = [...freq.values()].sort((a, b) => a - b)
    // 出現回数が下位半分に入るルートを「スパイス」とみなす
    const threshold = counts[Math.floor((counts.length - 1) / 2)]
    return tokens.filter((t) => (freq.get(rootKey(t)) ?? 0) <= threshold)
  })
}

/**
 * 終止をぼかす(未解決にする)ときの装飾。そのスタイルの装飾設定から選ぶ。
 * aug はぼかしではなく緊張を足してしまうので除く。
 */
export function openColors(style: StyleId, lower: boolean): string[] {
  const prefs = STYLE_PREFS[style]
  return (lower ? prefs.minorColors : prefs.majorColors).filter((c) => c !== "aug")
}

/** V の和音に使ってよい装飾。テンプレートの V に付いているもの+長三和音用の装飾 */
export function dominantColors(style: StyleId, mode: Mode): string[] {
  return memoized(`dom-${style}-${mode}`, () => {
    const onV = allTokens(style, mode)
      .filter((t) => rootKey(t) === "V")
      .map((t) => parseToken(t).suffix)
      .filter((s) => s !== "")
    return onV.length > 0 ? onV : STYLE_PREFS[style].majorColors
  })
}
