import { create } from "zustand"
import { chordPlayer, type PlaySegment } from "@/features/audio/chordPlayer"
import { STYLE_TEMPO } from "@/features/chord-engine/templates"
import type { StyleId } from "@/types/music"

interface PlayerStore {
  /** 再生中の進行のid(なければnull) */
  playingId: string | null
  /** 曲全体の試聴中に鳴っているセクションの番号(0始まり)。それ以外は null */
  playingSegment: number | null
  /** bpm を省略するとスタイルの標準テンポ。曲の中のセクションは曲のテンポを渡す */
  play(id: string, chords: string[], style: StyleId, beats?: number[], bpm?: number): void
  /**
   * 曲全体(セクションの並び・繰り返し込み)を続けて鳴らす。同じidで呼ぶと停止。
   * startIndex を渡すとそのセクションから鳴らす(再生中でも、その位置から鳴らし直す)
   */
  playSequence(id: string, segments: PlaySegment[], bpm: number, startIndex?: number): void
  stop(): void
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  playingId: null,
  playingSegment: null,

  play(id, chords, style, beats, bpm) {
    get().playSequence(id, [{ chords, beats, style }], bpm ?? STYLE_TEMPO[style])
  },

  playSequence(id, segments, bpm, startIndex) {
    if (get().playingId === id && startIndex === undefined) {
      get().stop()
      return
    }
    set({ playingId: id, playingSegment: null })
    void chordPlayer
      .playSequence(segments, {
        bpm,
        startIndex,
        onSegment: (index) => {
          if (get().playingId === id) set({ playingSegment: index })
        },
        onEnded: () => {
          if (get().playingId === id) set({ playingId: null, playingSegment: null })
        },
      })
      .catch(() => {
        if (get().playingId !== id) return
        chordPlayer.stop()
        set({ playingId: null, playingSegment: null })
      })
  },

  stop() {
    chordPlayer.stop()
    set({ playingId: null, playingSegment: null })
  },
}))
