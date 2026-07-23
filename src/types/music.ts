export type Mode = "major" | "minor"

export interface MusicKey {
  tonic: string // 例: "F#", "Bb"
  mode: Mode
}

export type StyleId =
  | "ethereal"
  | "romanticDark"
  | "cinematic"
  | "newWave"
  | "symphonicRock"
  | "ritual"
  | "finale"

export type SectionId =
  | "intro"
  | "verse"
  | "verse1"
  | "verse2"
  | "verse3"
  | "preChorus"
  | "chorus"
  | "bridge"
  | "finalChorus"
  | "outro"

/** エンジンの生成ルール上の基底セクション(Verse 1/2/3 は verse のルールを使う) */
export type RuleSection = "intro" | "verse" | "preChorus" | "chorus" | "bridge" | "finalChorus" | "outro"

export function sectionRule(section: SectionId): RuleSection {
  if (section === "verse1" || section === "verse2" || section === "verse3") return "verse"
  return section
}

export type MoodId =
  | "melancholic"
  | "mysterious"
  | "romantic"
  | "dark"
  | "hopeful"
  | "dramatic"
  | "floating"
  | "tense"

export type VariationCount = 5 | 10 | 20

/** 実用重視のキーリスト(マイナー優先・一般的な綴りのみ) */
export const MINOR_KEYS: MusicKey[] = [
  { tonic: "A", mode: "minor" },
  { tonic: "E", mode: "minor" },
  { tonic: "B", mode: "minor" },
  { tonic: "F#", mode: "minor" },
  { tonic: "C#", mode: "minor" },
  { tonic: "G#", mode: "minor" },
  { tonic: "D", mode: "minor" },
  { tonic: "G", mode: "minor" },
  { tonic: "C", mode: "minor" },
  { tonic: "F", mode: "minor" },
  { tonic: "Bb", mode: "minor" },
  { tonic: "Eb", mode: "minor" },
]

export const MAJOR_KEYS: MusicKey[] = [
  { tonic: "C", mode: "major" },
  { tonic: "G", mode: "major" },
  { tonic: "D", mode: "major" },
  { tonic: "A", mode: "major" },
  { tonic: "E", mode: "major" },
  { tonic: "B", mode: "major" },
  { tonic: "F#", mode: "major" },
  { tonic: "F", mode: "major" },
  { tonic: "Bb", mode: "major" },
  { tonic: "Eb", mode: "major" },
  { tonic: "Ab", mode: "major" },
  { tonic: "Db", mode: "major" },
]

export function keyId(key: MusicKey): string {
  return `${key.tonic}-${key.mode}`
}

export function keyLabel(key: MusicKey): string {
  return key.mode === "minor" ? `${key.tonic}m` : key.tonic
}

export const SECTION_OPTIONS: { value: SectionId; label: string }[] = [
  { value: "intro", label: "Intro" },
  { value: "verse", label: "Verse" },
  { value: "verse1", label: "Verse 1" },
  { value: "verse2", label: "Verse 2" },
  { value: "verse3", label: "Verse 3" },
  { value: "preChorus", label: "Pre-Chorus" },
  { value: "chorus", label: "Chorus" },
  { value: "bridge", label: "Bridge" },
  { value: "finalChorus", label: "Final Chorus" },
  { value: "outro", label: "Outro" },
]

/** 曲の流れ(Intro→…→Outro)に沿った、パートごとの識別色(Badge用) */
const SECTION_BADGE_CLASSES: Record<RuleSection, string> = {
  intro: "border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400",
  verse: "border-teal-500/30 bg-teal-500/15 text-teal-600 dark:text-teal-400",
  preChorus: "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
  chorus: "border-primary/40 bg-primary/15 text-primary",
  bridge: "border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-400",
  finalChorus: "border-rose-500/30 bg-rose-500/15 text-rose-600 dark:text-rose-400",
  outro: "border-slate-500/30 bg-slate-500/15 text-slate-600 dark:text-slate-400",
}

export function sectionBadgeClass(section: SectionId): string {
  return SECTION_BADGE_CLASSES[sectionRule(section)]
}

export const MOOD_OPTIONS: { value: MoodId; label: string }[] = [
  { value: "melancholic", label: "Melancholic" },
  { value: "mysterious", label: "Mysterious" },
  { value: "romantic", label: "Romantic" },
  { value: "dark", label: "Dark" },
  { value: "hopeful", label: "Hopeful" },
  { value: "dramatic", label: "Dramatic" },
  { value: "floating", label: "Floating" },
  { value: "tense", label: "Tense" },
]

export const VARIATION_OPTIONS: VariationCount[] = [5, 10, 20]
