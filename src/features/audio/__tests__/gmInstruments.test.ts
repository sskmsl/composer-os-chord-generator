import { describe, expect, it } from "vitest"
import { gmSequenceRequests } from "../chordPlayer"
import {
  DEFAULT_PART_PROGRAMS,
  DEFAULT_SOUND_SETTINGS,
  GM_INSTRUMENT_CHOICES,
  GM_PROGRAM_FILES,
  gmFileForProgram,
  normalizeSoundSettings,
} from "../gmInstruments"
import { parseChordSymbol } from "../chordSymbols"

describe("GM の楽器と設定", () => {
  it("128音色の並びが GM のプログラム番号と一致する", () => {
    expect(GM_PROGRAM_FILES).toHaveLength(128)
    expect(gmFileForProgram(0)).toBe("acoustic_grand_piano")
    expect(gmFileForProgram(32)).toBe("acoustic_bass")
    expect(gmFileForProgram(89)).toBe("pad_2_warm")
  })

  it("画面で選べる楽器は、重複のない GM の番号", () => {
    const programs = GM_INSTRUMENT_CHOICES.map((choice) => choice.program)
    expect(new Set(programs).size).toBe(programs.length)
    expect(programs.every((program) => program >= 0 && program <= 127)).toBe(true)
  })

  it("初めて開く端末(保存なし)はGM音源で始まり、シンプルを選んだ設定は保たれる", () => {
    expect(normalizeSoundSettings(null).playback).toBe("gm")
    expect(normalizeSoundSettings({}).playback).toBe("gm")
    expect(normalizeSoundSettings({ playback: "simple" }).playback).toBe("simple")
    expect(normalizeSoundSettings({ playback: "broken" }).playback).toBe("gm")
    expect(DEFAULT_SOUND_SETTINGS.midiExport).toBe("logic")
  })

  it("保存された設定の壊れた値や足りない項目は、既定値で補う", () => {
    expect(normalizeSoundSettings(undefined)).toEqual(DEFAULT_SOUND_SETTINGS)
    const normalized = normalizeSoundSettings({ playback: "gm", midiExport: "gm", programs: { chords: 4, bass: -1 } })
    expect(normalized).toEqual({ playback: "gm", midiExport: "gm", programs: { chords: 4, bass: DEFAULT_PART_PROGRAMS.bass } })
  })
})

describe("GM音源で鳴らすときに読み込む音", () => {
  it("コードの音はコードの楽器、ベースの音はベースの楽器で集め、開始位置より前のセクションは読み込まない", () => {
    const requests = gmSequenceRequests(
      [
        { chords: ["F", "G"], style: "romanticDark" },
        { chords: ["Am", "C/E"], style: "romanticDark" },
      ],
      1,
      { chords: 0, bass: 32 },
    )
    const am = parseChordSymbol("Am")!
    const ce = parseChordSymbol("C/E")!
    expect([...requests.keys()].sort()).toEqual(["acoustic_bass", "acoustic_grand_piano"])
    expect([...requests.get("acoustic_bass")!].sort()).toEqual([am.bass, ce.bass].sort())
    expect([...requests.get("acoustic_grand_piano")!].sort()).toEqual([...new Set([...am.notes, ...ce.notes])].sort())
    const f = parseChordSymbol("F")!
    expect(requests.get("acoustic_bass")!.has(f.bass) && f.bass !== am.bass && f.bass !== ce.bass).toBe(false)
  })
})
