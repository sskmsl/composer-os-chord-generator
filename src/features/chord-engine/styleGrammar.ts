import type { Mode, StyleId } from "@/types/music"
import type { ParsedChord } from "./degrees"
import { chordIntervals, degreeSemitone, parseToken } from "./degrees"
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

/** 和音の基本の3音(根音・3度・5度)のピッチクラス。装飾やスラッシュベースは無視する */
function triadPitchClasses(token: string): number[] {
  const p = parseToken(token)
  const root = degreeSemitone(p.acc, p.roman)
  return chordIntervals({ ...p, bass: undefined })
    .slice(0, 3)
    .map((interval) => (root + interval) % 12)
}

/**
 * 代理和音の候補: 同じスタイル・調のテンプレートに出てくる和音のうち、根音が違い、
 * 基本の3音を2つ以上共有するもの(例: C と Am、F と Dm)。共通音が多いので和声の働きが近く、
 * 差し替えても進行の流れを崩さずに骨格だけを変えられる。語彙はテンプレートの範囲に収まる。
 */
export function commonToneSubstitutes(style: StyleId, mode: Mode, token: string): string[] {
  const root = rootKey(token)
  const tones = triadPitchClasses(token)
  return memoized(`subst-${style}-${mode}-${token}`, () =>
    [...new Set(allTokens(style, mode))].filter((candidate) => {
      if (rootKey(candidate) === root) return false
      const shared = triadPitchClasses(candidate).filter((pc) => tones.includes(pc)).length
      return shared >= 2
    }),
  )
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

// ---------------------------------------------------------------------------
// スタイルのシグネチャー
// ---------------------------------------------------------------------------

const SEVENTH_FAMILY = new Set(["maj7", "m9", "m11", "7", "11"])
const OPEN_COLORS = new Set(["sus2", "add9", "m11", "11", "maj7"])

function chordRoot(c: ParsedChord): string {
  const acc = c.acc === -1 ? "b" : c.acc === 1 ? "#" : ""
  return `${acc}${c.lower ? c.roman.toLowerCase() : c.roman}`
}

const has = (chords: ParsedChord[], ...roots: string[]) => chords.some((c) => roots.includes(chordRoot(c)))
const isMajorV = (c: ParsedChord) => chordRoot(c) === "V"
/** 属七(長三和音+短7度)。V7だけでなく副属七(VI7/III7/II7)やbVII7も含む */
const isDominantSeventh = (c: ParsedChord) => !c.lower && c.suffix === "7"
const share = (chords: ParsedChord[], pred: (c: ParsedChord) => boolean) =>
  chords.filter(pred).length / chords.length
const distinctRoots = (chords: ParsedChord[]) => new Set(chords.map(chordRoot)).size
const colored = (c: ParsedChord) => c.suffix !== ""
/** ルートが完全5度ずつ下る動き(例: iv → bVII → bIII)が連続する最大回数 */
const fifthsDescent = (chords: ParsedChord[]) => {
  let best = 0
  let run = 0
  for (let i = 1; i < chords.length; i++) {
    const prev = degreeSemitone(chords[i - 1].acc, chords[i - 1].roman)
    const cur = degreeSemitone(chords[i].acc, chords[i].roman)
    run = (cur - prev + 12) % 12 === 5 ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

/**
 * そのスタイルに「聞こえる」ための最低条件。語彙(styleVocabulary)に収まって
 * いても、組み合わせ次第ではスタイルの性格が抜け落ちる(French Popなのに副属七も
 * ii–Vも無い、Slowcoreなのに7th和音が並ぶ等)。生成時にこの条件を満たさない候補は
 * 捨てる。条件は特定の曲ではなく、各ジャンルに共通する一般的な和声的特徴で定める。
 */
const STYLE_SIGNATURES: Record<StyleId, (chords: ParsedChord[], mode: Mode) => boolean> = {
  // 開いた響き(sus2/add9/11/maj7)があり、属七の引力を持たない
  ethereal: (cs) => cs.some((c) => OPEN_COLORS.has(c.suffix)) && !cs.some(isDominantSeventh),
  // 暗い引力: 短調ではV系・bII・#ivdim、長調では借用iv・V7系・ii7
  romanticDark: (cs, mode) =>
    mode === "minor" ? has(cs, "V", "bII", "#iv") : has(cs, "iv", "V", "ii"),
  // 映画的な借用・旋法和音(bVI/bVII/bIII)
  cinematic: (cs) => has(cs, "bVI", "bVII", "bIII") || has(cs, "V"),
  // 明快な三和音主体(色彩は6thを除いて1つまで)
  newWave: (cs) => cs.filter((c) => colored(c) && c.suffix !== "6").length <= 1,
  // 長調中の短調的な下属和音(借用iv)/短調のiv
  sadcorePop: (cs) => has(cs, "iv"),
  // 同じ和音へ戻ってくる反復(ドローン・オスティナート)があり、長調のVを使わない。
  // 2コードでは「戻る」余地がないので反復は3コード以上でだけ求める
  ritual: (cs) => (cs.length < 3 || distinctRoots(cs) < cs.length) && !cs.some(isMajorV),
  // 解放: トニックへの着地を含む
  finale: (cs, mode) => has(cs, mode === "minor" ? "i" : "I"),
  // 7th/6th/9thの都会的な色彩か、ミクソリディアンのbVIIの乾いた響き
  cool: (cs) => cs.some((c) => ["7", "6", "m9", "maj7"].includes(c.suffix)) || has(cs, "bVII"),
  // 少ない和音の催眠的な反復
  tripHop: (cs) => distinctRoots(cs) <= 3,
  // 機能和声・半音階的な和音(V7/iiø/dim/bII)
  neoclassical: (cs) => cs.some((c) => isMajorV(c) || c.suffix === "ø" || c.suffix === "dim") || has(cs, "bII"),
  // 簡素な骨格: 色彩は1つまで
  minimalism: (cs) => cs.filter(colored).length <= 1,
  // 異国情緒・機能的な引力(aug/bII/ø/V系/属七)
  jChanson: (cs) =>
    cs.some((c) => c.suffix === "aug" || c.suffix === "ø" || isMajorV(c) || isDominantSeventh(c)) || has(cs, "bII"),
  // 三和音主体で、V または bVII の推進力
  hiNRG: (cs) => has(cs, "V", "bVII") && cs.filter((c) => colored(c) && c.suffix !== "7" && c.suffix !== "6").length <= 1,
  // 短調ではドリアンのIV(長三和音)か短調のv、長調ではミクソリディアンのbVII。長調のVを使わない(短調)
  dorian: (cs, mode) => (mode === "minor" ? has(cs, "IV", "v") && !cs.some(isMajorV) : has(cs, "bVII", "IV")),
  // 7th/9th/11th系のパッドが半分以上で、長調のV(ドミナントの解決)を使わない
  electronica: (cs) => share(cs, (c) => SEVENTH_FAMILY.has(c.suffix)) >= 0.5 && !cs.some(isMajorV),
  // 飾らない三和音(7th系を使わず、色彩は1つまで)で、長調のVを使わない
  slowcore: (cs) =>
    !cs.some((c) => SEVENTH_FAMILY.has(c.suffix) || c.suffix === "6") &&
    cs.filter(colored).length <= 1 &&
    !cs.some(isMajorV),
  // 属七(V7・副属七・bVII7)かiiøの引力があり、7th/6th系の柔らかい和音が半分以上
  frenchPop: (cs) =>
    cs.some((c) => isDominantSeventh(c) || c.suffix === "ø") &&
    share(cs, (c) => ["maj7", "7", "6", "m9", "ø"].includes(c.suffix)) >= 0.5,
  // 和声的短音階のV・属七(I7/III7/VI7等)の引力か、5度ずつ下る循環があり、
  // add9/sus2/m9等の現代的な色彩を使わない(三和音+7th/6th中心)
  kayokyoku: (cs) =>
    (cs.some((c) => isMajorV(c) || isDominantSeventh(c)) || fifthsDescent(cs) >= 2) &&
    cs.every((c) => ["", "7", "6", "maj7", "ø", "sus4", "7sus4"].includes(c.suffix)),
}

export function matchesStyleSignature(style: StyleId, chords: ParsedChord[], mode: Mode): boolean {
  return STYLE_SIGNATURES[style](chords, mode)
}
