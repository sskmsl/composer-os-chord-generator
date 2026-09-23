import { parseChordSymbol } from "@/features/audio/chordSymbols"
import { STYLE_TEMPO } from "@/features/chord-engine/templates"
import type { Folder } from "@/types/folder"
import { SECTION_OPTIONS } from "@/types/music"
import type { SavedProgression } from "@/types/progression"
import type { Mode } from "@/types/music"
import { buildSmf, TICKS_PER_QUARTER, type MidiKeySignature, type MidiMarker, type MidiNote } from "./smf"

/** 1拍(4分音符)のtick数。既定は1コード=4拍=1小節だが、和声のリズムに合わせてコードごとに変える */
const BEAT_TICKS = TICKS_PER_QUARTER

/** フォルダ内の進行を並び順で取り出す(= 曲のセクション列) */
export function songSections(
  folder: Folder,
  progressions: SavedProgression[],
): SavedProgression[] {
  return progressions
    .filter((p) => p.folderId === folder.id)
    .sort((a, b) => a.order - b.order)
}

/** 曲全体のおおよその小節数(繰り返し込み。和声のリズムが可変のため4拍=1小節換算) */
export function songBarCount(sections: SavedProgression[]): number {
  const totalBeats = sections.reduce((sum, s) => {
    const sectionBeats = s.beats.reduce((a, b) => a + b, 0)
    return sum + sectionBeats * Math.max(1, s.repeatCount)
  }, 0)
  return Math.round(totalBeats / 4)
}

export function resolveTempo(folder: Folder, sections: SavedProgression[]): number {
  if (folder.tempo && folder.tempo > 0) return folder.tempo
  const first = sections[0]
  return first ? STYLE_TEMPO[first.style] : 90
}

const MAJOR_SIGNATURES: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
}
const MINOR_SIGNATURES: Record<string, number> = {
  A: 0, E: 1, B: 2, "F#": 3, "C#": 4, "G#": 5, "D#": 6, "A#": 7,
  D: -1, G: -2, C: -3, F: -4, Bb: -5, Eb: -6, Ab: -7,
}

/** "F#m" / "Bb" のようなキー表記から調号(♯・♭の数)を求める。不明なキーは null */
export function keySignatureOf(key: string, mode: Mode): Omit<MidiKeySignature, "tick"> | null {
  const tonic = key.trim().replace(/m$/, "")
  const table = mode === "minor" ? MINOR_SIGNATURES : MAJOR_SIGNATURES
  const sharpsFlats = table[tonic]
  return sharpsFlats === undefined ? null : { sharpsFlats, minor: mode === "minor" }
}

function sectionLabel(p: SavedProgression): string {
  const label = SECTION_OPTIONS.find((s) => s.value === p.section)?.label ?? p.section
  return `${label} (${p.key})`
}

/**
 * フォルダ(曲)をSMF Type 1 バイナリに変換する。
 * 各コードの長さは beats(和声のリズム。既定4拍、経過和音は短く終止は長く)に従い、
 * セクションは repeatCount 回繰り返す。
 * Chords(コードトーン)と Bass(コードのベース音、スラッシュコード対応)を
 * 別トラックに分け、Logic側で個別に音源を割り当てられるようにする。
 */
export function buildSongSmf(folder: Folder, progressions: SavedProgression[]): Uint8Array {
  const sections = songSections(folder, progressions)
  const tempo = resolveTempo(folder, sections)

  const chordNotes: MidiNote[] = []
  const bassNotes: MidiNote[] = []
  const markers: MidiMarker[] = []
  const keySignatures: MidiKeySignature[] = []
  let tick = 0

  for (const section of sections) {
    const repeat = Math.max(1, section.repeatCount)
    // 調号は調が変わる位置にだけ置く(同じ調の連続では置かない)
    const signature = keySignatureOf(section.key, section.mode)
    const previous = keySignatures.at(-1)
    if (signature && (!previous || previous.sharpsFlats !== signature.sharpsFlats || previous.minor !== signature.minor)) {
      keySignatures.push({ tick, ...signature })
    }
    for (let r = 0; r < repeat; r++) {
      // セクションマーカー(繰り返し2回目以降は #n を付す)
      markers.push({
        tick,
        text: repeat > 1 ? `${sectionLabel(section)} #${r + 1}` : sectionLabel(section),
      })
      section.chords.forEach((chord, index) => {
        const chordTicks = (section.beats[index] ?? 4) * BEAT_TICKS
        const voicing = parseChordSymbol(chord)
        if (voicing) {
          const duration = chordTicks - 10 // コード末にわずかな隙間を残す
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
        tick += chordTicks
      })
    }
  }

  return buildSmf({
    name: folder.name,
    tempoBpm: tempo,
    markers,
    keySignatures,
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
