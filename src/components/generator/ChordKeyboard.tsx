import { useMemo } from "react"
import { parseChordSymbol } from "@/features/audio/chordSymbols"

/**
 * コードの押さえる鍵盤をSVGピアノで表示する。
 * 表示域は C2〜B4 の3オクターブ(ベース帯域C2〜、コード帯域C3〜)。
 * コードトーン=赤系(primary)、ベース音=青系で塗り分ける。
 */
const LOW_MIDI = 36 // C2
const HIGH_MIDI = 77 // F5(m11の最高音 76 まで収まる)
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]
const WHITE_W = 14
const WHITE_H = 46
const BLACK_W = 9
const BLACK_H = 28

interface KeyInfo {
  midi: number
  isBlack: boolean
  x: number
}

function buildKeys(): KeyInfo[] {
  const keys: KeyInfo[] = []
  let whiteIndex = 0
  for (let midi = LOW_MIDI; midi <= HIGH_MIDI; midi++) {
    const pc = midi % 12
    if (WHITE_PCS.includes(pc)) {
      keys.push({ midi, isBlack: false, x: whiteIndex * WHITE_W })
      whiteIndex++
    } else {
      // 黒鍵は直前の白鍵の右端をまたぐ位置
      keys.push({ midi, isBlack: true, x: whiteIndex * WHITE_W - BLACK_W / 2 })
    }
  }
  return keys
}

const KEYS = buildKeys()
const TOTAL_W = KEYS.filter((k) => !k.isBlack).length * WHITE_W

interface Props {
  /** コード名(例: "F#m(add9)", "Fmaj7/A") */
  symbol: string
}

export function ChordKeyboard({ symbol }: Props) {
  const voicing = useMemo(() => parseChordSymbol(symbol), [symbol])
  if (!voicing) return null

  const chordNotes = new Set(voicing.notes)
  const bassNote = voicing.bass

  const fillFor = (midi: number, isBlack: boolean): string => {
    if (midi === bassNote) return "oklch(0.62 0.12 250)" // ベース=青
    if (chordNotes.has(midi)) return "var(--primary)" // コードトーン=赤
    return isBlack ? "oklch(0.22 0.015 310)" : "oklch(0.9 0.005 340)"
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-xs font-medium">{symbol}</p>
      <svg
        viewBox={`0 0 ${TOTAL_W} ${WHITE_H}`}
        width={TOTAL_W}
        height={WHITE_H}
        className="max-w-full rounded-sm"
        role="img"
        aria-label={`${symbol} の鍵盤ポジション`}
      >
        {KEYS.filter((k) => !k.isBlack).map((k) => (
          <rect
            key={k.midi}
            x={k.x}
            y={0}
            width={WHITE_W}
            height={WHITE_H}
            fill={fillFor(k.midi, false)}
            stroke="oklch(0.3 0.01 310)"
            strokeWidth={0.8}
          />
        ))}
        {KEYS.filter((k) => k.isBlack).map((k) => (
          <rect
            key={k.midi}
            x={k.x}
            y={0}
            width={BLACK_W}
            height={BLACK_H}
            rx={1}
            fill={fillFor(k.midi, true)}
            stroke="oklch(0.15 0.01 310)"
            strokeWidth={0.8}
          />
        ))}
      </svg>
    </div>
  )
}
