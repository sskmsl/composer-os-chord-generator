import type { MoodId, MusicKey, RuleSection, SectionId, StyleId } from "@/types/music"
import { keyLabel, sectionRule } from "@/types/music"
import type { GeneratedProgression } from "@/types/progression"
import type { ParsedChord } from "./degrees"
import { bassNoteName, buildToken, chordName, parseToken } from "./degrees"
import { decorateProgression } from "./decorate"
import { buildDescription } from "./descriptions"
import { chance, pick } from "./random"
import { computeScores, extractFeatures } from "./scoring"
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

  return pool.sort((a, b) => b.scores.boutonnat - a.scores.boutonnat).slice(0, params.count)
}

function generateOne(params: GenerateParams): GeneratedProgression {
  const { key, style, section, mood, length } = params

  const tokens = adaptToSection(generateChain(style, key.mode, mood, length), section, key)
  const decorated = decorateProgression(tokens.map(parseToken), style, mood)
  const parsed = applyVoiceLeadingBass(decorated, style)

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
    scores: computeScores(features, style, section, mood),
    createdAt: new Date().toISOString(),
  }
}

/** CHORD_ENGINE_SPEC §6 のセクションルールでテンプレートを変形する */
function adaptToSection(tokens: string[], section: SectionId, key: MusicKey): string[] {
  const minor = key.mode === "minor"
  let result = [...tokens]
  const rule: RuleSection = sectionRule(section)

  switch (rule) {
    case "intro":
      // 疎に: 2〜4コード、終止は未解決に
      if (chance(0.5)) result = result.slice(0, 2)
      result[result.length - 1] = unresolveToken(result[result.length - 1], minor)
      break

    case "verse":
      // 抑制: 強い解決(V7)を弱める
      if (/V7(?!sus)/.test(result[result.length - 1]) && chance(0.5)) {
        result[result.length - 1] = "Vsus4"
      }
      break

    case "preChorus":
      // 末尾をドミナント系にして緊張を作る
      result[result.length - 1] = pick(["V", "Vsus4", "V7sus4"])
      break

    case "chorus":
      break

    case "breakdownChorus":
      // 落ちサビ: サビの和声感を保ちながら密度と終止感を抑える
      if (result.length > 3) result = result.slice(0, 3)
      if (chance(0.65)) {
        result[result.length - 1] = unresolveToken(result[result.length - 1], minor)
      }
      break

    case "grandChorus":
      // 最後のサビ: 半分の確率でトニック終止を保証して解放感を出す
      if (minor && chance(0.5) && !/^i/.test(result[result.length - 1])) {
        result[result.length - 1] = pick(["i", "i(add9)"])
      }
      break

    case "cMelody":
      // Cメロ: 新しい和声景色を作りつつ、後続サビへ向かう緊張を残す
      if (minor && !/bII|#iv|ivm9/.test(result.join(" "))) {
        result[Math.min(1, result.length - 1)] = pick(["bII", "#ivdim", "ivm9"])
      }
      if (chance(0.55)) result[result.length - 1] = pick(["V", "Vsus4", "V7sus4"])
      break

    case "bridge":
      // 借用和音・意外な転回を注入する
      if (minor && !/bII|#iv|ivm9/.test(result.join(" ")) && chance(0.35)) {
        result[1] = pick(["bII", "#ivdim", "ivm9"])
      }
      break

    case "instrumental":
      // 間奏: 歌唱終止を要求せず、色彩和音と循環性を優先する
      if (result.length >= 2 && chance(0.5)) {
        result[result.length - 1] = result[0]
      }
      break

    case "outro":
      // 反復とフェード
      if (result.length >= 2 && chance(0.6)) {
        result = [result[0], result[1], result[0], pick([result[0], result[1]])]
      }
      if (chance(0.5)) {
        result[result.length - 1] = unresolveToken(result[result.length - 1], minor)
      }
      break
  }
  return result
}

/** トークンを未解決な響きに変える(sus化・add9化) */
function unresolveToken(token: string, minor: boolean): string {
  const parsed = parseToken(token)
  if (!parsed.lower && parsed.roman === "V" && parsed.acc === 0) {
    parsed.suffix = parsed.suffix === "7" ? "7sus4" : "sus4"
  } else if (parsed.suffix === "") {
    parsed.suffix = minor && parsed.lower ? "add9" : pick(["add9", "sus2"])
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
