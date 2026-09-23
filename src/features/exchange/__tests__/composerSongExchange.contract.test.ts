import { describe, it, expect } from "vitest"
// ?raw で文字列として読み込む(アプリ側の型設定はブラウザ向けで node:fs を使えないため)
import fixtureText from "../../../../contracts/composer-song-exchange.v2.example.json?raw"
import { buildComposerSongExchange } from "../composerSongExchange"
import { CONTRACT_EXPORTED_AT, CONTRACT_FOLDER, CONTRACT_PROGRESSIONS } from "./contractFixture"


describe("Composer Song Exchange の契約(Composer Arrangerと共有する見本)", () => {
  it("固定の入力から書き出した結果が、契約見本と完全に一致する", () => {
    // ここが落ちたら交換形式が変わっている。見本を更新し、Composer Arranger の
    // contracts/ にも同じ内容を置いて、Arranger側の読み込みテストを通すこと
    const exported = buildComposerSongExchange(CONTRACT_FOLDER, CONTRACT_PROGRESSIONS, CONTRACT_EXPORTED_AT)
    const fixture = JSON.parse(fixtureText)
    expect(JSON.parse(JSON.stringify(exported))).toEqual(fixture)
  })

  it("見本の各セクションは小節単位で、startBeatは直前までの長さの合計になっている", () => {
    const fixture = JSON.parse(fixtureText)
    expect(fixture.version).toBe(2)
    for (const section of fixture.sections) {
      let cursor = 0
      for (const chord of section.chords) {
        expect(chord.startBeat).toBe(cursor)
        cursor += chord.durationBeats
      }
      expect(cursor % 4).toBe(0)
    }
  })
})
