import { describe, expect, it } from "vitest"
import { GM_CHORD_OVERLAP, gmNoteLength } from "../chordPlayer"

describe("GM音源のコードの受け渡し", () => {
  it("前のコードを、次のコードの頭より後まで保つ", () => {
    // 4拍(72BPM)のコード: 次のコードは 3.33 秒後。前のコードはそれより後まで鳴り続ける
    const dur = 4 * (60 / 72)
    expect(gmNoteLength(dur)).toBeGreaterThan(dur)
    expect(gmNoteLength(dur) - dur).toBeCloseTo(GM_CHORD_OVERLAP, 6)
  })

  it("立ち上がりのゆっくりしたパッドが育つ間を覆える重なりがある", () => {
    expect(GM_CHORD_OVERLAP).toBeGreaterThanOrEqual(0.15)
  })

  it("音価が極端に短くても長さが0以下にならない", () => {
    expect(gmNoteLength(0)).toBeGreaterThan(0)
    expect(gmNoteLength(-1)).toBeGreaterThanOrEqual(0.05)
  })
})
