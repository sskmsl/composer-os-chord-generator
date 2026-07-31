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
  | "cool"
  | "tripHop"
  | "neoclassical"
  | "minimalism"

/** Composer Arrangerと共有する、曲中での音楽的な役割。 */
export type SectionRole =
  | "intro"
  | "verse"
  | "pre-chorus"
  | "chorus"
  | "breakdown-chorus"
  | "grand-chorus"
  | "c-melody"
  | "bridge"
  | "instrumental"
  | "outro"

/** 既存コードとの互換性を保つ別名。値はArrangerのSectionRoleと一致する。 */
export type SectionId = SectionRole

/** エンジン内部で使用する生成ルール。 */
export type RuleSection =
  | "intro"
  | "verse"
  | "preChorus"
  | "chorus"
  | "breakdownChorus"
  | "grandChorus"
  | "cMelody"
  | "bridge"
  | "instrumental"
  | "outro"

export function sectionRule(section: SectionId): RuleSection {
  if (section === "pre-chorus") return "preChorus"
  if (section === "breakdown-chorus") return "breakdownChorus"
  if (section === "grand-chorus") return "grandChorus"
  if (section === "c-melody") return "cMelody"
  return section
}

/** schema v3以前の値を共通ROLEへ移行する。 */
export function normalizeSectionRole(value: unknown): SectionRole {
  if (value === "verse1" || value === "verse2" || value === "verse3") return "verse"
  if (value === "preChorus") return "pre-chorus"
  if (value === "finalChorus") return "grand-chorus"
  if (
    value === "intro" ||
    value === "verse" ||
    value === "pre-chorus" ||
    value === "chorus" ||
    value === "breakdown-chorus" ||
    value === "grand-chorus" ||
    value === "c-melody" ||
    value === "bridge" ||
    value === "instrumental" ||
    value === "outro"
  ) {
    return value
  }
  return "verse"
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
  | "dance"

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

export const SECTION_ROLE_LABELS: Record<SectionRole, string> = {
  intro: "イントロ",
  verse: "Aメロ",
  "pre-chorus": "Bメロ",
  chorus: "サビ",
  "breakdown-chorus": "落ちサビ",
  "grand-chorus": "大サビ",
  "c-melody": "Cメロ",
  bridge: "ブリッジ",
  instrumental: "間奏",
  outro: "アウトロ",
}

export const SECTION_OPTIONS: { value: SectionId; label: string }[] = Object.entries(
  SECTION_ROLE_LABELS,
).map(([value, label]) => ({ value: value as SectionId, label }))

/** 曲の流れ(Intro→…→Outro)に沿った、パートごとの識別色(Badge用) */
const SECTION_BADGE_CLASSES: Record<RuleSection, string> = {
  intro: "border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400",
  verse: "border-teal-500/30 bg-teal-500/15 text-teal-600 dark:text-teal-400",
  preChorus: "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
  chorus: "border-primary/40 bg-primary/15 text-primary",
  breakdownChorus: "border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400",
  grandChorus: "border-rose-500/30 bg-rose-500/15 text-rose-600 dark:text-rose-400",
  cMelody: "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  bridge: "border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-400",
  instrumental: "border-cyan-500/30 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
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
  { value: "dance", label: "Dance" },
]

export const VARIATION_OPTIONS: VariationCount[] = [5, 10, 20]
