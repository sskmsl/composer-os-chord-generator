import { create } from "zustand"
import { chordPlayer } from "@/features/audio/chordPlayer"
import { STYLE_TEMPO } from "@/features/chord-engine/templates"
import type { StyleId } from "@/types/music"

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
    void chordPlayer
      .play(chords, {
        bpm: STYLE_TEMPO[style],
        onEnded: () => {
          if (get().playingId === id) set({ playingId: null })
        },
      })
      .catch(() => {
        if (get().playingId !== id) return
        chordPlayer.stop()
        set({ playingId: null })
      })
  },

  stop() {
    chordPlayer.stop()
    set({ playingId: null })
  },
}))
