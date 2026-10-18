import { describe, expect, it } from "vitest"
import { generateProgressions } from "@/features/chord-engine/generateProgressions"
import { createFolder } from "@/types/folder"
import type { MusicKey } from "@/types/music"
import { toSavedProgression } from "@/types/progression"
import { buildSongSmf, keySignatureOf } from "../exportSong"

function section(key: MusicKey, folderId: string, order: number) {
  const [generated] = generateProgressions({ key, style: "romanticDark", section: "verse", mood: "melancholic", count: 1 })
  return { ...toSavedProgression(generated, folderId), order }
}

/** SMF中の調号メタイベント(FF 59 02 sf mi)を順に取り出す */
function keySignatureEvents(bytes: Uint8Array): Array<{ sharpsFlats: number; minor: boolean }> {
  const found: Array<{ sharpsFlats: number; minor: boolean }> = []
  for (let i = 0; i + 4 < bytes.length; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0x59 && bytes[i + 2] === 0x02) {
      const raw = bytes[i + 3]
      found.push({ sharpsFlats: raw > 127 ? raw - 256 : raw, minor: bytes[i + 4] === 1 })
    }
  }
  return found
}

describe("MIDI書き出しの調号", () => {
  it("キー表記から♯・♭の数を求める", () => {
    expect(keySignatureOf("Am", "minor")).toEqual({ sharpsFlats: 0, minor: true })
    expect(keySignatureOf("F#m", "minor")).toEqual({ sharpsFlats: 3, minor: true })
    expect(keySignatureOf("Bbm", "minor")).toEqual({ sharpsFlats: -5, minor: true })
    expect(keySignatureOf("Db", "major")).toEqual({ sharpsFlats: -5, minor: false })
    expect(keySignatureOf("E", "major")).toEqual({ sharpsFlats: 4, minor: false })
  })

  it("先頭と、調が変わるセクションの頭にだけ調号を置く", () => {
    const folder = createFolder("調号テスト")
    const sections = [
      section({ tonic: "D", mode: "minor" }, folder.id, 1),
      section({ tonic: "D", mode: "minor" }, folder.id, 2),
      section({ tonic: "E", mode: "minor" }, folder.id, 3),
    ]
    expect(keySignatureEvents(buildSongSmf(folder, sections))).toEqual([
      { sharpsFlats: -1, minor: true },
      { sharpsFlats: 1, minor: true },
    ])
  })
})

/**
 * SMFを読み進めて、プログラムチェンジ(Cn pp)を [チャンネル, 楽器番号] で取り出す。
 * バイト列を走査すると、トラック名や和音のデータ内の値がたまたま一致して誤検出するため、
 * トラックのチャンクとイベントの区切り(デルタタイム・ランニングステータス・メタ・SysEx)をたどる。
 */
function programChanges(bytes: Uint8Array): Array<[number, number]> {
  const found: Array<[number, number]> = []
  const ascii = (at: number) => String.fromCharCode(...bytes.slice(at, at + 4))
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let pos = 8 + view.getUint32(4) // ヘッダチャンク(MThd)を飛ばす
  while (pos + 8 <= bytes.length && ascii(pos) === "MTrk") {
    const end = pos + 8 + view.getUint32(pos + 4)
    pos += 8
    let status = 0
    while (pos < end) {
      while (bytes[pos++] & 0x80) { /* デルタタイム(可変長)を読み飛ばす */ }
      if (bytes[pos] >= 0x80) status = bytes[pos++]
      if (status === 0xff) {
        pos++ // メタイベントの種類
        let length = 0
        let b: number
        do {
          b = bytes[pos++]
          length = (length << 7) | (b & 0x7f)
        } while (b & 0x80)
        pos += length
      } else if (status === 0xf0 || status === 0xf7) {
        let length = 0
        let b: number
        do {
          b = bytes[pos++]
          length = (length << 7) | (b & 0x7f)
        } while (b & 0x80)
        pos += length
      } else if ((status & 0xf0) === 0xc0 || (status & 0xf0) === 0xd0) {
        if ((status & 0xf0) === 0xc0) found.push([status & 0x0f, bytes[pos]])
        pos += 1
      } else {
        pos += 2
      }
    }
    pos = end
  }
  return found
}

describe("MIDI書き出しの形式", () => {
  const folder = createFolder("曲")
  const progressions = [section({ tonic: "A", mode: "minor" }, folder.id, 0)]

  it("Logic向け(既定)は楽器番号を入れない", () => {
    expect(programChanges(buildSongSmf(folder, progressions))).toEqual([])
  })

  it("GM向けは、コード(1ch)とベース(2ch)のトラックに楽器番号を入れる", () => {
    expect(programChanges(buildSongSmf(folder, progressions, { chords: 4, bass: 33 }))).toEqual([[0, 4], [1, 33]])
  })
})
