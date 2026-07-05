export function chance(p: number): boolean {
  return Math.random() < p
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

/** -1 / 0 / +1 の小さな揺らぎ */
export function jitter(): number {
  const r = Math.random()
  return r < 0.25 ? -1 : r < 0.75 ? 0 : 1
}
