import type { Folder } from "../../types/folder"
import type { SectionId } from "../../types/music"
import type { SavedProgression, Scores } from "../../types/progression"
import { resolveTempo, songSections } from "../midi/exportSong"

export const COMPOSER_SONG_EXCHANGE_FORMAT = "composer-os/song-exchange" as const
export const COMPOSER_SONG_EXCHANGE_VERSION = 1 as const

export type ExchangeSectionRole =
  | "intro"
  | "verse"
  | "pre-chorus"
  | "chorus"
  | "grand-chorus"
  | "bridge"
  | "outro"

export interface ComposerSongExchangeChord {
  symbol: string
  startBeat: number
  durationBeats: number
}

export interface ComposerSongExchangeSection {
  sourceId: string
  name: string
  role: ExchangeSectionRole
  key: string
  repeatCount: number
  chords: ComposerSongExchangeChord[]
  sourceIntent: {
    style: string
    mood: string
    scores: Scores
  }
}

/**
 * Composer OS内のアプリ間で受け渡す、特定アプリの保存スキーマに依存しない最小形式。
 * v1はChord Generatorの現行仕様に合わせ、4/4・1コード=1小節を明示する。
 */
export interface ComposerSongExchangeV1 {
  format: typeof COMPOSER_SONG_EXCHANGE_FORMAT
  version: typeof COMPOSER_SONG_EXCHANGE_VERSION
  source: {
    app: "composer-os-chord-generator"
    folderId: string
    exportedAt: string
  }
  title: string
  tempo: number
  timeSignature: "4/4"
  memo?: string
  sections: ComposerSongExchangeSection[]
}

const SECTION_NAMES: Record<SectionId, string> = {
  intro: "Intro",
  verse: "Verse",
  verse1: "Verse 1",
  verse2: "Verse 2",
  verse3: "Verse 3",
  preChorus: "Pre-Chorus",
  chorus: "Chorus",
  bridge: "Bridge",
  finalChorus: "Final Chorus",
  outro: "Outro",
}

export function toExchangeSectionRole(section: SectionId): ExchangeSectionRole {
  if (section === "intro") return "intro"
  if (section === "preChorus") return "pre-chorus"
  if (section === "chorus") return "chorus"
  if (section === "finalChorus") return "grand-chorus"
  if (section === "bridge") return "bridge"
  if (section === "outro") return "outro"
  return "verse"
}

export function buildComposerSongExchange(
  folder: Folder,
  progressions: SavedProgression[],
  exportedAt = new Date().toISOString(),
): ComposerSongExchangeV1 {
  const sections = songSections(folder, progressions)
  return {
    format: COMPOSER_SONG_EXCHANGE_FORMAT,
    version: COMPOSER_SONG_EXCHANGE_VERSION,
    source: {
      app: "composer-os-chord-generator",
      folderId: folder.id,
      exportedAt,
    },
    title: folder.name,
    tempo: resolveTempo(folder, sections),
    timeSignature: "4/4",
    memo: folder.memo,
    sections: sections.map((section) => ({
      sourceId: section.id,
      name: SECTION_NAMES[section.section],
      role: toExchangeSectionRole(section.section),
      key: section.key,
      repeatCount: Math.max(1, Math.round(section.repeatCount)),
      chords: section.chords.map((symbol, index) => ({
        symbol,
        startBeat: index * 4,
        durationBeats: 4,
      })),
      sourceIntent: {
        style: section.style,
        mood: section.mood,
        scores: section.scores,
      },
    })),
  }
}

export function downloadComposerSongExchange(
  folder: Folder,
  progressions: SavedProgression[],
): void {
  const exchange = buildComposerSongExchange(folder, progressions)
  const blob = new Blob([JSON.stringify(exchange, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${sanitizeFileName(folder.name)}.composer-song.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "_").trim()
  return cleaned === "" ? "composer-os-song" : cleaned
}
