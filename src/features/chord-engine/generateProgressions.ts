import type { MoodId, MusicKey, RuleSection, SectionId, StyleId } from "@/types/music"
import { keyLabel, sectionRule } from "@/types/music"
import type { GeneratedProgression } from "@/types/progression"
import type { ParsedChord } from "./degrees"
import { bassNoteName, buildToken, chordName, parseToken } from "./degrees"
import { decorateProgression } from "./decorate"
import { buildDescription } from "./descriptions"
import { chance, pick } from "./random"
import { computeScores, extractFeatures, type CadenceType } from "./scoring"
import { openColors, rootKey, spiceTokens, styleVocabulary, tensionTokens, tonicTokens } from "./styleGrammar"
import { generateChain } from "./transitions"
import { applyVoiceLeadingBass } from "./voiceLeading"

export interface GenerateParams {
  key: MusicKey
  style: StyleId
  section: SectionId
  mood: MoodId
  count: number
  /** 進行のコード数(2〜5)。省略時は3〜5でランダムに揺らぐ */
  length?: number
}

/**
 * メインエントリポイント。
 * テンプレート選択 → セクション変形 → 装飾 → 移調 → スコア/説明文 の
 * パイプラインで重複しない候補プールを作り、Boutonnat的な審美眼(boutonnat
 * スコア)を最終フィルタとして上位 count 件だけを返す。
 * 「安全だが平凡」な候補だけが並ばないよう、候補評価を出力選定に直結させる。
 * さらに、同じ style×調 を繰り返し使ったときにルート進行の「骨格」
 * (色彩・スラッシュを無視した度数の並び)が何度も出てこないよう、
 * セッション内の直近履歴で軽く減点する(§骨格反復の抑制)。
 */
export function generateProgressions(params: GenerateParams): GeneratedProgression[] {
  const poolTarget = Math.min(params.count * 3, 60)
  const maxAttempts = poolTarget * 6
  const pool: GeneratedProgression[] = []
  const seen = new Set<string>()

  for (let attempt = 0; attempt < maxAttempts && pool.length < poolTarget; attempt++) {
    const progression = generateOne(params)
    const dedupKey = progression.chords.join("|")
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    pool.push(progression)
  }

  const selected = rankAndSelect(pool, params.style, params.key.mode, params.count)
  if (!REPETITIVE_STYLES.has(params.style)) {
    const bucket = skeletonBucket(params.style, params.key.mode)
    for (const p of selected) recordSkeleton(bucket, rootSkeletonOf(p.romanNumerals))
  }
  return selected
}

/**
 * 骨格反復の抑制はstyle×調(=Markovの語彙プールと同じ単位)ごとに履歴を持つ。
 * ブラウザセッション中(タブを開いている間)だけ効く軽量な仕組みで、
 * 保存済みライブラリ全体との突き合わせまでは行わない。
 */
const SKELETON_HISTORY_LIMIT = 40
const skeletonHistory = new Map<string, string[]>()

function skeletonBucket(style: StyleId, mode: MusicKey["mode"]): string {
  return `${style}-${mode}`
}

/** 色彩(サフィックス)・スラッシュベースを無視した、度数だけのルート進行 */
export function rootSkeletonOf(romanNumerals: string[]): string {
  return romanNumerals
    .map((token) => {
      const p = parseToken(token)
      const accStr = p.acc === -1 ? "b" : p.acc === 1 ? "#" : ""
      return accStr + (p.lower ? p.roman.toLowerCase() : p.roman)
    })
    .join("-")
}

function recordSkeleton(bucket: string, skeleton: string): void {
  const list = skeletonHistory.get(bucket) ?? []
  list.push(skeleton)
  if (list.length > SKELETON_HISTORY_LIMIT) list.shift()
  skeletonHistory.set(bucket, list)
}

function wasRecentlyUsed(bucket: string, skeleton: string): boolean {
  return skeletonHistory.get(bucket)?.includes(skeleton) ?? false
}

/**
 * Minimalism/Trip-Hop/Ritualは同じ骨格を反復すること自体が持ち味のスタイルなので、
 * 和声のリズム変化(§computeHarmonicRhythm)と骨格反復の抑制のどちらも対象外とする。
 */
const REPETITIVE_STYLES = new Set<StyleId>(["minimalism", "tripHop", "ritual"])

function rankAndSelect(
  pool: GeneratedProgression[],
  style: StyleId,
  mode: MusicKey["mode"],
  count: number,
): GeneratedProgression[] {
  // スコアは決定的な整数なので同点が多い。1未満の乱数を足して同点内の順序だけを
  // 揺らし、同じ条件で何度生成しても同じ顔ぶれに偏らないようにする
  // (異なる点数の大小関係は崩さない)。
  const bucket = skeletonBucket(style, mode)
  const penalty = (p: GeneratedProgression) =>
    !REPETITIVE_STYLES.has(style) && wasRecentlyUsed(bucket, rootSkeletonOf(p.romanNumerals)) ? 3 : 0
  const ranked = pool.map((p) => ({ p, rank: p.scores.boutonnat - penalty(p) + Math.random() * 0.99 }))
  return ranked
    .sort((a, b) => b.rank - a.rank)
    .slice(0, count)
    .map(({ p }) => p)
}

function generateOne(params: GenerateParams): GeneratedProgression {
  const { key, style, section, mood, length } = params

  const tokens = adaptToSection(generateChain(style, key.mode, mood, length), section, key, style)
  const decorated = decorateProgression(tokens.map(parseToken), style, mood, key.mode)
  const { chords: parsed, invertedIndices } = applyVoiceLeadingBass(decorated, style)

  const chords = parsed.map((c) => chordName(c, key))
  const romanNumerals = parsed.map((c) => c.token)
  const features = extractFeatures(parsed, key.mode)

  return {
    id: crypto.randomUUID(),
    chords,
    key: keyLabel(key),
    mode: key.mode,
    style,
    section,
    mood,
    romanNumerals,
    bassMovement: describeBassMovement(parsed, key),
    description: buildDescription(style, mood, section, features),
    scores: computeScores(features),
    beats: computeHarmonicRhythm(parsed.length, style, invertedIndices, features.cadence),
    createdAt: new Date().toISOString(),
  }
}

/**
 * 常に4拍固定だった和声のリズムに緩急を作る。声部進行で転回した経過的な
 * コードは短く軽く通過させ、機能和声的にしっかり着地する終止は長く持たせて
 * 「一度和声を引いてから解放する」呼吸を生む。REPETITIVE_STYLESは
 * 均等な反復そのものが持ち味のスタイルなので対象外とする。
 */
function computeHarmonicRhythm(
  length: number,
  style: StyleId,
  invertedIndices: Set<number>,
  cadence: CadenceType,
): number[] {
  const beats = Array.from({ length }, () => 4)
  if (REPETITIVE_STYLES.has(style)) return beats

  for (const i of invertedIndices) {
    if (chance(0.7)) beats[i] = 2
  }

  const lastIdx = length - 1
  if (lastIdx > 0 && (cadence === "authentic" || cadence === "plagal") && chance(0.6)) {
    beats[lastIdx] = 8
  }

  return beats
}

/** CHORD_ENGINE_SPEC §6 のセクションルールでテンプレートを変形する */
function adaptToSection(tokens: string[], section: SectionId, key: MusicKey, style: StyleId): string[] {
  const mode = key.mode
  let result = [...tokens]
  const rule: RuleSection = sectionRule(section)
  const last = () => result.length - 1
  // 変形で差し込む和音は、すべてそのスタイルのテンプレートから選ぶ(styleGrammar.ts)
  const hasSpice = () => {
    const spiceRoots = new Set(spiceTokens(style, mode).map(rootKey))
    return result.some((t) => spiceRoots.has(rootKey(t)))
  }

  switch (rule) {
    case "intro":
      // 疎に: 2〜4コード、終止は未解決に
      if (chance(0.5)) result = result.slice(0, 2)
      result[last()] = unresolveToken(result[last()], style, mode)
      break

    case "verse":
      // 抑制: 強い解決(V7)を弱める
      if (/V7(?!sus)/.test(result[last()]) && chance(0.5)) {
        result[last()] = unresolveToken(result[last()], style, mode)
      }
      break

    case "preChorus":
      // 末尾を、そのスタイルが実際に使う「トニック以外の終わり方」にして緊張を作る
      result[last()] = pick(tensionTokens(style, mode))
      break

    case "chorus":
      break

    case "breakdownChorus":
      // 落ちサビ: サビの和声感を保ちながら密度と終止感を抑える
      if (result.length > 3) result = result.slice(0, 3)
      if (chance(0.65)) {
        result[last()] = unresolveToken(result[last()], style, mode)
      }
      break

    case "grandChorus": {
      // 最後のサビ: 半分の確率でトニック終止を保証して解放感を出す
      const tonics = tonicTokens(style, mode)
      if (mode === "minor" && tonics.length > 0 && chance(0.5) && rootKey(result[last()]) !== "i") {
        result[last()] = pick(tonics)
      }
      break
    }

    case "cMelody":
      // Cメロ: そのスタイルにとっての色彩和音で新しい景色を作り、後続サビへの緊張を残す
      if (!hasSpice()) result[Math.min(1, last())] = pick(spiceTokens(style, mode))
      if (chance(0.55)) result[last()] = pick(tensionTokens(style, mode))
      break

    case "bridge":
      // そのスタイルの色彩和音・意外な和音を注入する
      if (result.length >= 2 && !hasSpice() && chance(0.35)) {
        result[1] = pick(spiceTokens(style, mode))
      }
      break

    case "instrumental":
      // 間奏: 歌唱終止を要求せず、色彩和音と循環性を優先する
      if (result.length >= 2 && chance(0.5)) {
        result[last()] = result[0]
      }
      break

    case "outro":
      // 反復とフェード
      if (result.length >= 2 && chance(0.6)) {
        result = [result[0], result[1], result[0], pick([result[0], result[1]])]
      }
      if (chance(0.5)) {
        result[last()] = unresolveToken(result[last()], style, mode)
      }
      break
  }
  return result
}

/**
 * 終止をぼかす。V はそのスタイルが持つsus形へ、素の和音はそのスタイルの
 * 装飾(Ritualならsus2、New Waveなら6th等)へ。スタイルに該当する装飾が
 * なければ手を付けない(スタイル外の響きを足さない)。
 */
function unresolveToken(token: string, style: StyleId, mode: MusicKey["mode"]): string {
  const parsed = parseToken(token)
  const allowed = styleVocabulary(style, mode).suffixes
  if (!parsed.lower && parsed.roman === "V" && parsed.acc === 0) {
    if (parsed.suffix.includes("sus")) return token
    const options = parsed.suffix === "7" ? ["7sus4", "sus4"] : ["sus4", "7sus4"]
    const next = options.find((s) => allowed.has(s))
    if (!next) return token
    parsed.suffix = next
  } else if (parsed.suffix === "") {
    const colors = openColors(style, parsed.lower)
    if (colors.length === 0) return token
    parsed.suffix = pick(colors)
  }
  return buildToken(parsed)
}

/** ベースの動きを音名列+輪郭ラベルで表現する */
function describeBassMovement(parsed: ParsedChord[], key: MusicKey): string {
  const names = parsed.map((c) => bassNoteName(c, key))

  let desc = 0
  let asc = 0
  let pedal = 0
  for (let i = 1; i < names.length; i++) {
    if (names[i] === names[i - 1]) {
      pedal++
      continue
    }
    // 最短経路で方向を推定
    const prev = noteIndex(names[i - 1])
    const cur = noteIndex(names[i])
    if ((prev - cur + 12) % 12 <= 5) desc++
    else asc++
  }

  const steps = names.length - 1
  let label: string
  if (pedal === steps) label = "ペダル"
  else if (desc >= steps - pedal && desc > 0 && asc === 0) label = "下降ライン"
  else if (asc >= steps - pedal && asc > 0 && desc === 0) label = "上昇ライン"
  else if (names[0] === names[names.length - 1]) label = "回帰型"
  else label = "起伏型"

  return `${names.join(" → ")}(${label})`
}

const NOTE_INDEX: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
}

function noteIndex(name: string): number {
  return NOTE_INDEX[name] ?? 0
}
