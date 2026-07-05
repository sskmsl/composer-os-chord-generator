/**
 * エンジンが出力するコード名(例: "F#m(add9)", "Fmaj7/A", "Bm7b5")を
 * 再生用のピッチ情報に解析する。
 */
export interface ChordVoicing {
  /** ベース音のMIDIノート番号 */
  bass: number
  /** コードトーンのMIDIノート番号(ベースを除く) */
  notes: number[]
}

const NOTE_TO_PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
}

/** コード品質 → ルートからの半音インターバル */
const QUALITY_INTERVALS: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  m7b5: [0, 3, 6, 10],
  maj7: [0, 4, 7, 11],
  mMaj7: [0, 3, 7, 11],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  add9: [0, 4, 7, 14],
  "m(add9)": [0, 3, 7, 14],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
  "11": [0, 4, 7, 10, 14, 17],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
}

const ROOT_RE = /^([A-G][#b]?)(.*)$/

/** コード名を解析してボイシングを返す。未知の品質はメジャートライアドにフォールバック */
export function parseChordSymbol(symbol: string): ChordVoicing | null {
  const [main, bassName] = symbol.split("/")
  const m = ROOT_RE.exec(main.trim())
  if (!m) return null
  const rootPc = NOTE_TO_PC[m[1]]
  if (rootPc == null) return null
  const intervals = QUALITY_INTERVALS[m[2]] ?? [0, 4, 7]

  const bassPc = bassName != null ? (NOTE_TO_PC[bassName.trim()] ?? rootPc) : rootPc

  // ルートは C3〜B3 (MIDI 48–59)、ベースはその1オクターブ下の帯域に置く
  const rootMidi = 48 + rootPc
  const bassMidi = 36 + bassPc

  return {
    bass: bassMidi,
    notes: intervals.map((i) => rootMidi + i),
  }
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}
