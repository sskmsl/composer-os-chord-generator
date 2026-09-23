import type { StyleId } from "@/types/music"
import type { ParsedChord } from "./degrees"
import { bassSemitoneOf, buildToken, chordIntervals, degreeForSemitone, degreeSemitone } from "./degrees"
import { STYLE_PREFS } from "./templates"
import { chance } from "./random"

export interface VoiceLeadingResult {
  chords: ParsedChord[]
  /** applyVoiceLeadingBass が実際に転回を選んだコードの添字(和声のリズム調整に使う) */
  invertedIndices: Set<number>
}

/**
 * コード記号(ルート位置)しか持たないエンジンに、実際のベース選択で
 * 声部進行の滑らかさを作る。前のコードのベースと最短距離になる転回形
 * (3度・5度をベースに)が根音のままより明確に近ければ、その転回へ
 * 差し替える。先頭・末尾のコードは(進行の輪郭を保つため)対象外。
 * 既に借用和音のペダル(decorate.ts)でスラッシュが付いている場合は触らない。
 */
export function applyVoiceLeadingBass(chords: ParsedChord[], style: StyleId): VoiceLeadingResult {
  const prob = STYLE_PREFS[style].slashProb
  const result = chords.map((c) => ({ ...c, bass: c.bass ? { ...c.bass } : undefined }))
  const invertedIndices = new Set<number>()

  for (let i = 1; i < result.length - 1; i++) {
    const cur = result[i]
    if (cur.bass) continue
    if (cur.suffix === "dim" || cur.suffix === "ø" || cur.suffix === "aug") continue

    const prevBass = bassSemitoneOf(result[i - 1])
    const rootSemi = degreeSemitone(cur.acc, cur.roman)
    const inversionTones = chordIntervals(cur).slice(1, 3).map((iv) => (rootSemi + iv) % 12)

    let best = rootSemi
    let bestDist = shortestDistance(prevBass, rootSemi)
    for (const tone of inversionTones) {
      const dist = shortestDistance(prevBass, tone)
      // 根音のままより明確に(2半音以上)近くなる場合だけ転回を検討する
      if (dist < bestDist - 1) {
        best = tone
        bestDist = dist
      }
    }

    if (best !== rootSemi && chance(prob)) {
      const deg = degreeForSemitone(best)
      const accStr = deg.acc === -1 ? "b" : deg.acc === 1 ? "#" : ""
      cur.bass = { acc: deg.acc, roman: deg.roman, raw: `${accStr}${deg.roman.toLowerCase()}` }
      cur.token = buildToken(cur)
      invertedIndices.add(i)
    }
  }
  return { chords: result, invertedIndices }
}

function shortestDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 12
  return Math.min(d, 12 - d)
}
