import { midiToFreq, parseChordSymbol } from "./chordSymbols"

/**
 * Web Audio API によるコード進行プレイヤー。
 * 外部音源を使わず、ダークなパッド風のシンセ音で1コード=4拍ずつ再生する。
 */
export interface PlayOptions {
  bpm: number
  onEnded: () => void
}

class ChordPlayer {
  private ctx: AudioContext | null = null
  private endTimer: number | null = null

  async play(chords: string[], { bpm, onEnded }: PlayOptions): Promise<void> {
    this.stop()

    const ctx = new AudioContext()
    this.ctx = ctx
    await ctx.resume()

    // マスターチェーン: コンプレッサー → マスターゲイン
    const master = ctx.createGain()
    master.gain.value = 0.8
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.ratio.value = 6
    compressor.connect(master)
    master.connect(ctx.destination)

    const chordDur = (60 / bpm) * 4 // 4拍
    const start = ctx.currentTime + 0.06

    chords.forEach((symbol, i) => {
      const voicing = parseChordSymbol(symbol)
      if (!voicing) return
      const t0 = start + i * chordDur
      this.scheduleChord(ctx, compressor, voicing.bass, voicing.notes, t0, chordDur)
    })

    const total = chords.length * chordDur + 1.2 // リリースの余韻ぶん
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
  ): void {
    const attack = 0.05
    const release = 0.5
    const holdEnd = t0 + dur - 0.08

    // コードトーン: デチューンした2枚のsawをローパスに通したパッド
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.setValueAtTime(700, t0)
    filter.frequency.linearRampToValueAtTime(1300, t0 + dur * 0.5)
    filter.frequency.linearRampToValueAtTime(800, holdEnd)
    filter.Q.value = 0.7
    filter.connect(dest)

    for (const midi of notes) {
      const freq = midiToFreq(midi)
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator()
        osc.type = "sawtooth"
        osc.frequency.value = freq
        osc.detune.value = detune
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0, t0)
        gain.gain.linearRampToValueAtTime(0.05, t0 + attack)
        gain.gain.setValueAtTime(0.05, holdEnd)
        gain.gain.linearRampToValueAtTime(0, holdEnd + release)
        osc.connect(gain)
        gain.connect(filter)
        osc.start(t0)
        osc.stop(holdEnd + release + 0.05)
      }
    }

    // ベース: サイン波でしっかり支える
    const bassOsc = ctx.createOscillator()
    bassOsc.type = "sine"
    bassOsc.frequency.value = midiToFreq(bass)
    const bassGain = ctx.createGain()
    bassGain.gain.setValueAtTime(0, t0)
    bassGain.gain.linearRampToValueAtTime(0.22, t0 + attack)
    bassGain.gain.setValueAtTime(0.22, holdEnd)
    bassGain.gain.linearRampToValueAtTime(0, holdEnd + release)
    bassOsc.connect(bassGain)
    bassGain.connect(dest)
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
    if (this.ctx) {
      void this.ctx.close().catch(() => {})
      this.ctx = null
    }
  }
}

export const chordPlayer = new ChordPlayer()
