import type { StyleId } from "@/types/music"
import { midiToFreq, parseChordSymbol } from "./chordSymbols"

/**
 * Web Audio API によるコード進行プレイヤー。
 * 外部音源を使わず、スタイルごとに音色(波形・フィルタ・エンベロープ)を
 * 変えたシンセ音で1コード=4拍ずつ再生する。
 */
export interface PlayOptions {
  bpm: number
  style: StyleId
  onEnded: () => void
  /** 各コードの長さ(拍数)。省略時・配列長が足りない分は4拍として扱う */
  beats?: number[]
}

/** 曲全体の試聴で続けて鳴らす、セクション1つ分(音色はセクションのスタイルに合わせる) */
export interface PlaySegment {
  chords: string[]
  beats?: number[]
  style: StyleId
}

export interface SequenceOptions {
  bpm: number
  onEnded: () => void
  /** セクションが切り替わるたびに、その番号(0始まり)を知らせる */
  onSegment?: (index: number) => void
  /** このセクションから鳴らし始める(0始まり)。省略時は先頭から */
  startIndex?: number
}

interface VoiceProfile {
  waveform: OscillatorType
  /** 2枚のオシレーターのデチューン幅(セント) */
  detune: number
  /** ローパスフィルタの掃引開始/ピーク周波数 */
  filterBase: number
  filterPeak: number
  filterQ: number
  /** アタックタイム(秒) */
  attack: number
  /** アタック後にこの比率まで減衰する(1なら減衰なし=パッド、低いほどプラック感) */
  sustainLevel: number
  /** sustainLevel<1のときの減衰にかける時間(秒) */
  decay: number
  /** リリースタイム(秒) */
  release: number
  chordGain: number
  bassGain: number
}

const DEFAULT_VOICE: VoiceProfile = {
  waveform: "sawtooth",
  detune: 6,
  filterBase: 700,
  filterPeak: 1300,
  filterQ: 0.7,
  attack: 0.05,
  sustainLevel: 1,
  decay: 0.15,
  release: 0.5,
  chordGain: 0.05,
  bassGain: 0.22,
}

/** スタイルごとの音色差分。指定のないパラメータは DEFAULT_VOICE を使う */
const STYLE_VOICES: Partial<Record<StyleId, Partial<VoiceProfile>>> = {
  ethereal: {
    waveform: "triangle",
    detune: 9,
    filterBase: 900,
    filterPeak: 2200,
    attack: 0.35,
    release: 0.9,
    chordGain: 0.045,
  },
  cinematic: {
    detune: 10,
    filterBase: 500,
    filterPeak: 2000,
    attack: 0.2,
    release: 1.0,
    chordGain: 0.055,
  },
  newWave: {
    waveform: "square",
    detune: 4,
    filterBase: 900,
    filterPeak: 1600,
    filterQ: 3,
    attack: 0.02,
    release: 0.25,
    chordGain: 0.035,
  },
  sadcorePop: {
    waveform: "triangle",
    detune: 11,
    filterBase: 450,
    filterPeak: 1600,
    attack: 0.3,
    release: 1.3,
    chordGain: 0.05,
  },
  ritual: {
    waveform: "sine",
    detune: 2,
    filterBase: 500,
    filterPeak: 700,
    attack: 0.5,
    release: 1.2,
    chordGain: 0.05,
  },
  finale: {
    detune: 12,
    filterBase: 700,
    filterPeak: 2400,
    attack: 0.15,
    release: 1.1,
    chordGain: 0.055,
  },
  cool: {
    waveform: "triangle",
    detune: 3,
    filterBase: 900,
    filterPeak: 1500,
    attack: 0.02,
    sustainLevel: 0.55,
    decay: 0.25,
    release: 0.3,
    chordGain: 0.045,
  },
  tripHop: {
    detune: 5,
    filterBase: 350,
    filterPeak: 650,
    attack: 0.15,
    release: 0.6,
    chordGain: 0.045,
    bassGain: 0.3,
  },
  neoclassical: {
    waveform: "triangle",
    detune: 2,
    filterBase: 1400,
    filterPeak: 1800,
    attack: 0.008,
    sustainLevel: 0.35,
    decay: 0.35,
    release: 0.7,
    chordGain: 0.05,
  },
  minimalism: {
    waveform: "triangle",
    detune: 0,
    filterBase: 1200,
    filterPeak: 1200,
    attack: 0.005,
    sustainLevel: 0.25,
    decay: 0.15,
    release: 0.2,
    chordGain: 0.045,
  },
  jChanson: {
    waveform: "triangle",
    detune: 5,
    filterBase: 800,
    filterPeak: 1300,
    attack: 0.06,
    release: 0.65,
    chordGain: 0.048,
  },
  hiNRG: {
    waveform: "square",
    detune: 3,
    filterBase: 1100,
    filterPeak: 2000,
    filterQ: 4,
    attack: 0.01,
    release: 0.2,
    chordGain: 0.035,
  },
  dorian: {
    waveform: "triangle",
    detune: 7,
    filterBase: 700,
    filterPeak: 1400,
    attack: 0.1,
    release: 0.6,
    chordGain: 0.05,
  },
  electronica: {
    waveform: "sawtooth",
    detune: 14,
    filterBase: 450,
    filterPeak: 1700,
    attack: 0.4,
    release: 1.4,
    chordGain: 0.04,
  },
  slowcore: {
    waveform: "triangle",
    detune: 4,
    filterBase: 600,
    filterPeak: 900,
    attack: 0.25,
    release: 1.6,
    chordGain: 0.05,
  },
  frenchPop: {
    waveform: "triangle",
    detune: 3,
    filterBase: 1000,
    filterPeak: 1600,
    attack: 0.02,
    sustainLevel: 0.5,
    decay: 0.3,
    release: 0.5,
    chordGain: 0.045,
  },
  kayokyoku: {
    // 80年代のFMエレピ+ストリングスを思わせる、明るすぎない中域
    waveform: "triangle",
    detune: 6,
    filterBase: 900,
    filterPeak: 1800,
    attack: 0.03,
    sustainLevel: 0.6,
    decay: 0.4,
    release: 0.8,
    chordGain: 0.05,
  },
}

function getVoice(style: StyleId): VoiceProfile {
  return { ...DEFAULT_VOICE, ...STYLE_VOICES[style] }
}

/** 先読みして予約しておく長さ(秒)。曲全体を一度に予約すると、長い曲で音源の数が膨らんで重くなる */
const LOOKAHEAD_SECONDS = 6
/** 先読みを補充する間隔(ミリ秒) */
const SCHEDULER_INTERVAL_MS = 500

interface ScheduledChord {
  /** 再生開始からの秒数 */
  at: number
  dur: number
  symbol: string
  voice: VoiceProfile
  segmentIndex: number
}

class ChordPlayer {
  private ctx: AudioContext | null = null
  private endTimer: number | null = null
  private schedulerTimer: number | null = null

  async play(chords: string[], { bpm, style, onEnded, beats }: PlayOptions): Promise<void> {
    return this.playSequence([{ chords, beats, style }], { bpm, onEnded })
  }

  /**
   * 複数のセクションを1本のタイムラインとして続けて鳴らす(曲全体の試聴)。
   * startIndex を渡すと、そのセクションから鳴らし始める(onSegment には元の番号を知らせる)。
   * 音は数秒先までを少しずつ予約するので、長い曲でも最初に重くならない。
   */
  async playSequence(
    segments: PlaySegment[],
    { bpm, onEnded, onSegment, startIndex = 0 }: SequenceOptions,
  ): Promise<void> {
    this.stop()

    const ctx = new AudioContext()
    this.ctx = ctx
    await ctx.resume()
    // resume を待つ間に停止・別の再生が始まっていたら何もしない
    if (this.ctx !== ctx) return

    // マスターチェーン: コンプレッサー → マスターゲイン
    const master = ctx.createGain()
    master.gain.value = 0.8
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.ratio.value = 6
    compressor.connect(master)
    master.connect(ctx.destination)

    const beatDur = 60 / bpm
    const timeline: ScheduledChord[] = []
    const segmentStarts: { at: number; index: number }[] = []
    let elapsed = 0
    let lastRelease = DEFAULT_VOICE.release
    segments.forEach((segment, segmentIndex) => {
      if (segmentIndex < startIndex) return
      const voice = getVoice(segment.style)
      lastRelease = voice.release
      segmentStarts.push({ at: elapsed, index: segmentIndex })
      segment.chords.forEach((symbol, i) => {
        const dur = (segment.beats?.[i] ?? 4) * beatDur
        timeline.push({ at: elapsed, dur, symbol, voice, segmentIndex })
        elapsed += dur
      })
    })

    const start = ctx.currentTime + 0.06
    let next = 0
    let currentSegment = -1
    const pump = () => {
      if (this.ctx !== ctx) return
      const now = ctx.currentTime - start
      while (next < timeline.length && timeline[next].at < now + LOOKAHEAD_SECONDS) {
        const chord = timeline[next]
        const voicing = parseChordSymbol(chord.symbol)
        if (voicing) {
          this.scheduleChord(ctx, compressor, voicing.bass, voicing.notes, start + chord.at, chord.dur, chord.voice)
        }
        next += 1
      }
      if (onSegment) {
        const playing = segmentStarts.filter((s) => s.at <= Math.max(0, now)).at(-1)
        if (playing && playing.index !== currentSegment) {
          currentSegment = playing.index
          onSegment(playing.index)
        }
      }
    }
    pump()
    this.schedulerTimer = window.setInterval(pump, SCHEDULER_INTERVAL_MS)

    const total = elapsed + lastRelease + 0.7 // リリースの余韻ぶん
    this.endTimer = window.setTimeout(() => {
      this.dispose()
      onEnded()
    }, total * 1000)
  }

  private scheduleChord(
    ctx: AudioContext,
    dest: AudioNode,
    bass: number,
    notes: number[],
    t0: number,
    dur: number,
    voice: VoiceProfile,
  ): void {
    const { attack, release, sustainLevel, chordGain, bassGain } = voice
    // アタック+減衰がコード長を超えないよう安全マージンを取る
    const decay = Math.min(voice.decay, Math.max(dur - attack - 0.1, 0))
    const holdEnd = t0 + dur - 0.08
    const sustainGain = chordGain * sustainLevel
    const bassSustainGain = bassGain * sustainLevel

    // コードトーン: デチューンした2枚のオシレーターをローパスに通す
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    const filterEnd = voice.filterBase + (voice.filterPeak - voice.filterBase) * 0.15
    filter.frequency.setValueAtTime(voice.filterBase, t0)
    filter.frequency.linearRampToValueAtTime(voice.filterPeak, t0 + dur * 0.5)
    filter.frequency.linearRampToValueAtTime(filterEnd, holdEnd)
    filter.Q.value = voice.filterQ
    filter.connect(dest)

    for (const midi of notes) {
      const freq = midiToFreq(midi)
      for (const detune of [-voice.detune, voice.detune]) {
        const osc = ctx.createOscillator()
        osc.type = voice.waveform
        osc.frequency.value = freq
        osc.detune.value = detune
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0, t0)
        gain.gain.linearRampToValueAtTime(chordGain, t0 + attack)
        if (sustainLevel < 1) {
          gain.gain.linearRampToValueAtTime(sustainGain, t0 + attack + decay)
        }
        gain.gain.setValueAtTime(sustainGain, holdEnd)
        gain.gain.linearRampToValueAtTime(0, holdEnd + release)
        osc.connect(gain)
        gain.connect(filter)
        osc.start(t0)
        osc.stop(holdEnd + release + 0.05)
      }
    }

    // ベース: サイン波でしっかり支える(エンベロープはコードトーンと共通)
    const bassOsc = ctx.createOscillator()
    bassOsc.type = "sine"
    bassOsc.frequency.value = midiToFreq(bass)
    const bassGainNode = ctx.createGain()
    bassGainNode.gain.setValueAtTime(0, t0)
    bassGainNode.gain.linearRampToValueAtTime(bassGain, t0 + attack)
    if (sustainLevel < 1) {
      bassGainNode.gain.linearRampToValueAtTime(bassSustainGain, t0 + attack + decay)
    }
    bassGainNode.gain.setValueAtTime(bassSustainGain, holdEnd)
    bassGainNode.gain.linearRampToValueAtTime(0, holdEnd + release)
    bassOsc.connect(bassGainNode)
    bassGainNode.connect(dest)
    bassOsc.start(t0)
    bassOsc.stop(holdEnd + release + 0.05)
  }

  stop(): void {
    if (this.endTimer != null) {
      clearTimeout(this.endTimer)
      this.endTimer = null
    }
    this.dispose()
  }

  private dispose(): void {
    if (this.schedulerTimer != null) {
      clearInterval(this.schedulerTimer)
      this.schedulerTimer = null
    }
    if (this.ctx) {
      void this.ctx.close().catch(() => {})
      this.ctx = null
    }
  }
}

export const chordPlayer = new ChordPlayer()
