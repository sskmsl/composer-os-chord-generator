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
