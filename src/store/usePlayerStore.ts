import { create } from "zustand"
import { chordPlayer } from "@/features/audio/chordPlayer"
import type { StyleId } from "@/types/music"

/** スタイルごとの試聴テンポ(BPM) */
const STYLE_TEMPO: Record<StyleId, number> = {
  ethereal: 76,
  romanticDark: 84,
  cinematic: 80,
  newWave: 112,
  symphonicRock: 96,
  ritual: 70,
  finale: 88,
}

interface PlayerStore {
  /** 再生中の進行のid(なければnull) */
  playingId: string | null
  play(id: string, chords: string[], style: StyleId): void
  stop(): void
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  playingId: null,

  play(id, chords, style) {
    if (get().playingId === id) {
      get().stop()
      return
    }
    set({ playingId: id })
    void chordPlayer.play(chords, {
      bpm: STYLE_TEMPO[style],
      onEnded: () => {
        if (get().playingId === id) set({ playingId: null })
      },
    })
  },

  stop() {
    chordPlayer.stop()
    set({ playingId: null })
  },
}))
