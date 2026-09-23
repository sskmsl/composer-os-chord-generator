import type { Features } from "@/features/chord-engine/scoring"

/**
 * 進行の特徴を、好みの学習に使うタグへ変換する。点数(Craft等)の計算に使う特徴のうち、
 * 聴いた印象を左右するものだけを選ぶ。
 */
export function featureTags(f: Features): string[] {
  const tags: string[] = []
  if (f.hasSlash) tags.push("slash")
  if (f.pedalBass) tags.push("pedal")
  if (f.descendingBass) tags.push("descendingBass")
  if (f.ascendingBass) tags.push("ascendingBass")
  if (f.chromaticInnerSteps > 0) tags.push("chromaticInner")
  if (f.commonToneStrength >= 1.4) tags.push("commonTones")
  if (f.softColorCount >= 2) tags.push("softColors")
  if (f.surpriseCount === 1 || f.surpriseCount === 2) tags.push("oneOrTwoSurprises")
  if (f.surpriseCount >= 3) tags.push("manySurprises")
  if (f.hasBviBviiTonic) tags.push("bVI-bVII-i")
  if (f.hasV7) tags.push("dominantSeventh")
  if (f.hasDim) tags.push("diminished")
  if (f.hasBII) tags.push("neapolitan")
  if (f.hasAug) tags.push("augmented")
  if (f.largeArc) tags.push("wideRange")
  if (f.endsUnresolved) tags.push("unresolvedEnding")
  if (f.plainDiatonic) tags.push("plain")
  tags.push(`cadence:${f.cadence}`)
  return tags
}

/** 表示した候補1件の記録。保存されたら saved が true になる */
export interface FeedbackRecord {
  id: string
  at: string
  style: string
  mode: string
  tags: string[]
  saved: boolean
}

export interface PreferenceModel {
  /** タグ → 重み(-1〜+1)。正なら保存されやすい特徴 */
  weights: Record<string, number>
  savedCount: number
}

/** 好みを順位に反映し始める保存数。少ないうちは偶然の偏りを拾うだけなので使わない */
export const MIN_SAVES_FOR_PREFERENCE = 30
/** 1タグの重みを満額にするのに必要な、そのタグを持つ候補の表示数 */
const FULL_CONFIDENCE_EXPOSURES = 20
const MAX_BONUS = 2

/**
 * 表示した候補と保存の記録から、特徴ごとの「保存されやすさ」を学ぶ。
 * 重み = log(そのタグを持つ候補の保存率 / 全体の保存率)。件数が少ないタグは信頼度で縮める。
 * 保存数が MIN_SAVES_FOR_PREFERENCE 未満なら null(まだ補正しない)。
 */
export function learnPreference(records: readonly FeedbackRecord[]): PreferenceModel | null {
  const total = records.length
  const savedCount = records.filter((r) => r.saved).length
  if (savedCount < MIN_SAVES_FOR_PREFERENCE) return null

  const baseRate = (savedCount + 1) / (total + 2)
  const exposures = new Map<string, number>()
  const saves = new Map<string, number>()
  for (const r of records) {
    for (const tag of r.tags) {
      exposures.set(tag, (exposures.get(tag) ?? 0) + 1)
      if (r.saved) saves.set(tag, (saves.get(tag) ?? 0) + 1)
    }
  }

  const weights: Record<string, number> = {}
  for (const [tag, n] of exposures) {
    const rate = ((saves.get(tag) ?? 0) + 1) / (n + 2)
    const confidence = Math.min(1, n / FULL_CONFIDENCE_EXPOSURES)
    weights[tag] = Math.max(-1, Math.min(1, Math.log(rate / baseRate))) * confidence
  }
  return { weights, savedCount }
}

/** 候補の特徴から、好みによる順位の補正値(-2〜+2)を求める */
export function preferenceBonus(model: PreferenceModel | null | undefined, tags: readonly string[]): number {
  if (!model) return 0
  const sum = tags.reduce((acc, tag) => acc + (model.weights[tag] ?? 0), 0)
  return Math.max(-MAX_BONUS, Math.min(MAX_BONUS, sum))
}
