import { describe, expect, it } from "vitest"
import { analyzeSample, gmNoteName, gmSampleFor, parseSoundfontScript, scheduleGmSample } from "../gmSampler"

describe("GM音源のサンプル", () => {
  it("音名はフラットで書き、中央のドは C4", () => {
    expect(gmNoteName(60)).toBe("C4")
    expect(gmNoteName(61)).toBe("Db4")
    expect(gmNoteName(21)).toBe("A0")
    expect(gmNoteName(108)).toBe("C8")
  })

  it("音域(A0〜C8)の外の音は、端のサンプルの再生速度を変えて鳴らす", () => {
    expect(gmSampleFor(60)).toEqual({ sampleMidi: 60, playbackRate: 1 })
    const high = gmSampleFor(110)
    expect(high.sampleMidi).toBe(108)
    expect(high.playbackRate).toBeCloseTo(Math.pow(2, 2 / 12), 6)
  })

  it("楽器ファイル(JS)から音名と data URL を取り出す", () => {
    const text = `if (typeof(MIDI) === 'undefined') var MIDI = {};
MIDI.Soundfont.acoustic_grand_piano = {
"A0": "data:audio/mp3;base64,AAAA",
"Bb0": "data:audio/mp3;base64,BBBB",
"C8": "data:audio/mp3;base64,CCCC"
}`
    const notes = parseSoundfontScript(text)
    expect([...notes.keys()]).toEqual(["A0", "Bb0", "C8"])
    expect(notes.get("Bb0")).toBe("data:audio/mp3;base64,BBBB")
  })
})

const RATE = 8000

/** 波形から AudioBuffer 相当の最小限のオブジェクトを作る(jsdom に AudioBuffer は無い) */
function fakeBuffer(seconds: number, wave: (t: number) => number): AudioBuffer {
  const data = Float32Array.from({ length: Math.floor(seconds * RATE) }, (_, i) => wave(i / RATE))
  return { sampleRate: RATE, length: data.length, duration: seconds, numberOfChannels: 1, getChannelData: () => data } as unknown as AudioBuffer
}

const tone = (t: number) => 0.5 * Math.sin(2 * Math.PI * 220 * t)

describe("サンプルの形(analyzeSample)", () => {
  it("頭の無音を見つけて、そこから再生を始める", () => {
    const buffer = fakeBuffer(2, (t) => (t < 0.04 ? 0 : tone(t)))
    expect(analyzeSample(buffer).start).toBeCloseTo(0.04, 2)
  })

  it("頭に無音が無いサンプルは先頭から鳴らす", () => {
    expect(analyzeSample(fakeBuffer(2, tone)).start).toBeLessThan(0.01)
  })

  it("長すぎる無音(音の一部とみなす)は切り詰めない", () => {
    const buffer = fakeBuffer(2, (t) => (t < 0.5 ? 0 : tone(t)))
    expect(analyzeSample(buffer).start).toBe(0)
  })

  it("自然に減衰して終わるサンプルは繰り返さない", () => {
    const decaying = fakeBuffer(3, (t) => tone(t) * Math.exp(-3 * t))
    expect(analyzeSample(decaying).loop).toBeNull()
  })

  it("持続したまま終わるサンプルは、終端近くを繰り返す区間にする", () => {
    const sustained = fakeBuffer(3, tone)
    const { loop } = analyzeSample(sustained)
    expect(loop).not.toBeNull()
    expect(loop!.start).toBeCloseTo(3 - 0.35, 2)
    expect(loop!.end).toBeCloseTo(3 - 0.15, 2)
  })

  it("短すぎて末尾を調べられないサンプルは繰り返さない", () => {
    expect(analyzeSample(fakeBuffer(0.2, tone)).loop).toBeNull()
  })

  it("無音だけのサンプルでも壊れない", () => {
    expect(analyzeSample(fakeBuffer(1, () => 0))).toEqual({ start: 0, loop: null })
  })
})

describe("scheduleGmSample", () => {
  function fakeContext() {
    const source = {
      buffer: null as AudioBuffer | null,
      playbackRate: { value: 1 },
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      connect: () => {},
      start: (..._args: number[]) => {},
      stop: () => {},
    }
    const started: number[][] = []
    source.start = (...args: number[]) => {
      started.push(args)
    }
    const param = { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }
    const ctx = {
      createBufferSource: () => source,
      createGain: () => ({ gain: param, connect: () => {} }),
    } as unknown as BaseAudioContext
    return { ctx, source, started }
  }

  it("頭の無音を飛ばして、発音の時刻ちょうどに音が出るようにする", () => {
    const { ctx, started } = fakeContext()
    scheduleGmSample(ctx, {} as AudioNode, fakeBuffer(2, (t) => (t < 0.04 ? 0 : tone(t))), 60, 62, 10, 3)
    expect(started).toHaveLength(1)
    expect(started[0][0]).toBe(10)
    expect(started[0][1]).toBeCloseTo(0.04, 2)
  })

  it("持続したまま終わるサンプルは、コードの終わりまで保てるよう繰り返す", () => {
    const { ctx, source } = fakeContext()
    scheduleGmSample(ctx, {} as AudioNode, fakeBuffer(3, tone), 60, 62, 0, 6)
    expect(source.loop).toBe(true)
    expect(source.loopStart).toBeCloseTo(2.65, 2)
    expect(source.loopEnd).toBeCloseTo(2.85, 2)
  })

  it("減衰して終わるサンプルは繰り返さない", () => {
    const { ctx, source } = fakeContext()
    scheduleGmSample(ctx, {} as AudioNode, fakeBuffer(3, (t) => tone(t) * Math.exp(-3 * t)), 60, 62, 0, 6)
    expect(source.loop).toBe(false)
  })
})
