import { parseChordSymbol } from "@/features/audio/chordSymbols"
import { STYLE_TEMPO } from "@/features/chord-engine/templates"
import type { Folder } from "@/types/folder"
import { SECTION_OPTIONS } from "@/types/music"
import type { SavedProgression } from "@/types/progression"
import { buildSmf, TICKS_PER_QUARTER, type MidiMarker, type MidiNote } from "./smf"

/** 1コード = 1小節(4/4) */
const BAR_TICKS = TICKS_PER_QUARTER * 4

/** フォルダ内の進行を並び順で取り出す(= 曲のセクション列) */
export function songSections(
  folder: Folder,
  progressions: SavedProgression[],
): SavedProgression[] {
  return progressions
    .filter((p) => p.folderId === folder.id)
    .sort((a, b) => a.order - b.order)
}

/** 曲全体の小節数(繰り返し込み) */
export function songBarCount(sections: SavedProgression[]): number {
  return sections.reduce((sum, s) => sum + s.chords.length * Math.max(1, s.repeatCount), 0)
}

export function resolveTempo(folder: Folder, sections: SavedProgression[]): number {
  if (folder.tempo && folder.tempo > 0) return folder.tempo
  const first = sections[0]
  return first ? STYLE_TEMPO[first.style] : 90
}

function sectionLabel(p: SavedProgression): string {
  const label = SECTION_OPTIONS.find((s) => s.value === p.section)?.label ?? p.section
  return `${label} (${p.key})`
}

/**
 * フォルダ(曲)をSMF Type 1 バイナリに変換する。
 * 各コード=1小節、セクションは repeatCount 回繰り返す。
 * Chords(コードトーン)と Bass(コードのベース音、スラッシュコード対応)を
 * 別トラックに分け、Logic側で個別に音源を割り当てられるようにする。
 */
export function buildSongSmf(folder: Folder, progressions: SavedProgression[]): Uint8Array {
  const sections = songSections(folder, progressions)
  const tempo = resolveTempo(folder, sections)

  const chordNotes: MidiNote[] = []
  const bassNotes: MidiNote[] = []
  const markers: MidiMarker[] = []
  let tick = 0

  for (const section of sections) {
    const repeat = Math.max(1, section.repeatCount)
    for (let r = 0; r < repeat; r++) {
      // セクションマーカー(繰り返し2回目以降は #n を付す)
      markers.push({
        tick,
        text: repeat > 1 ? `${sectionLabel(section)} #${r + 1}` : sectionLabel(section),
      })
      for (const chord of section.chords) {
        const voicing = parseChordSymbol(chord)
        if (voicing) {
          const duration = BAR_TICKS - 10 // 小節末にわずかな隙間を残す
          for (const pitch of dedupe(voicing.notes)) {
            chordNotes.push({ pitch, start: tick, duration, velocity: 78, channel: 0 })
          }
          bassNotes.push({
            pitch: voicing.bass,
            start: tick,
            duration,
            velocity: 92,
            channel: 1,
          })
        }
        tick += BAR_TICKS
      }
    }
  }

  return buildSmf({
    name: folder.name,
    tempoBpm: tempo,
    markers,
    tracks: [
      // コンダクター側のマーカーだけでなく、各トラック自身にも同じラベルを
      // メモ書き(Text event)として埋め込み、そのトラックだけを見ても
      // 今どのパートかが分かるようにする
      { name: "Chords", notes: chordNotes, textEvents: markers },
      { name: "Bass", notes: bassNotes, textEvents: markers },
    ],
  })
}

/** 生成したSMFを .mid としてダウンロードさせる */
export function downloadSongSmf(folder: Folder, progressions: SavedProgression[]): void {
  const bytes = buildSongSmf(folder, progressions)
  // buildSmf は number[] から生成した専用バッファなので buffer をそのまま使える
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/midi" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${sanitizeFileName(folder.name)}.mid`
  a.click()
  URL.revokeObjectURL(url)
}

function dedupe(nums: number[]): number[] {
  return [...new Set(nums)]
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "_").trim()
  return cleaned === "" ? "composer-os-song" : cleaned
}
