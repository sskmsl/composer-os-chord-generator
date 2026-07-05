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
