import type { Mode, MoodId, StyleId } from "@/types/music"
import { MOOD_PROFILES, STYLE_TEMPLATES } from "./templates"
import { chance, pick } from "./random"

/**
 * STYLE_TEMPLATES(スタイルごとに手作りした8パターン)を「教師データ」として、
 * ディグリー間の遷移確率テーブルを組み立て、そこからその場で新しい進行を
 * 生成する。固定8パターンの使い回しではなく、スタイルの語彙を保ったまま
 * 組み合わせを大きく広げるのが狙い。
 */

interface TransitionData {
  /** 進行の先頭になりうるトークン(元テンプレートの1つ目の要素) */
  starts: string[]
  /** ルート度数 → 続きうる次のトークン群(頻度がそのまま重みになる) */
  table: Record<string, string[]>
}

const ROOT_RE = /^([b#]?)(i{1,3}|iv|v|vi{0,2}|I{1,3}|IV|V|VI{0,2})/

/** サフィックス・スラッシュベースを無視し、ルート度数(例: "bVI", "V")だけ取り出す */
function rootOf(token: string): string {
  const main = token.replace(/[()]/g, "").split("/")[0]
  const m = ROOT_RE.exec(main)
  return m ? `${m[1]}${m[2]}` : main
}

function buildTransitionTable(templates: string[][]): TransitionData {
  const starts: string[] = []
  const table: Record<string, string[]> = {}
  for (const template of templates) {
    starts.push(template[0])
    for (let i = 0; i < template.length - 1; i++) {
      const from = rootOf(template[i])
      ;(table[from] ??= []).push(template[i + 1])
    }
  }
  return { starts, table }
}

const cache = new Map<string, TransitionData>()

function getTransitionData(style: StyleId, mode: Mode): TransitionData {
  const key = `${style}-${mode}`
  let data = cache.get(key)
  if (!data) {
    data = buildTransitionTable(STYLE_TEMPLATES[style][mode])
    cache.set(key, data)
  }
  return data
}

/** 生成する進行の長さ。4を中心に、たまに3や5にも揺らぐ */
const CHAIN_LENGTHS = [3, 4, 4, 4, 5]

export function generateChain(style: StyleId, mode: Mode, mood: MoodId): string[] {
  const { starts, table } = getTransitionData(style, mode)
  const affinity = MOOD_PROFILES[mood].affinity
  const targetLen = pick(CHAIN_LENGTHS)

  let current = pick(starts)
  const chain = [current]
  while (chain.length < targetLen) {
    const candidates = table[rootOf(current)]
    if (!candidates || candidates.length === 0) break
    const preferred = candidates.filter((c) => affinity.some((a) => c.includes(a)))
    const pool = preferred.length > 0 && chance(0.5) ? preferred : candidates
    current = pick(pool)
    chain.push(current)
  }

  // 行き止まりで短くなりすぎた場合は、手作りテンプレートそのものにフォールバックする
  return chain.length >= 3 ? chain : pick(STYLE_TEMPLATES[style][mode])
}
