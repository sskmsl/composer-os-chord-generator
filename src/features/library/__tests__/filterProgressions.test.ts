import { describe, expect, it } from "vitest"
import { generateProgressions } from "@/features/chord-engine/generateProgressions"
import { toSavedProgression, type SavedProgression } from "@/types/progression"
import { matchesQuery, sortProgressions } from "../filterProgressions"

function saved(patch: Partial<SavedProgression>): SavedProgression {
  const [generated] = generateProgressions({
    key: { tonic: "A", mode: "minor" },
    style: "romanticDark",
    section: "verse",
    mood: "melancholic",
    count: 1,
  })
  return { ...toSavedProgression(generated, null), ...patch }
}

describe("保存一覧の検索", () => {
  const p = saved({ chords: ["Am", "Fmaj7", "E7"], romanNumerals: ["i", "bVImaj7", "V7"], memo: "雨の日のサビ候補" })

  it("コード名・度数・メモ・フォルダ名のどれかに含まれれば一致し、大文字小文字は区別しない", () => {
    expect(matchesQuery(p, "fmaj7", undefined)).toBe(true)
    expect(matchesQuery(p, "bVI", undefined)).toBe(true)
    expect(matchesQuery(p, "雨の日", undefined)).toBe(true)
    expect(matchesQuery(p, "夜想曲", "夜想曲 No.2")).toBe(true)
    expect(matchesQuery(p, "Dm", undefined)).toBe(false)
  })

  it("空白で区切った語はすべて含むものだけに絞る", () => {
    expect(matchesQuery(p, "Am E7", undefined)).toBe(true)
    expect(matchesQuery(p, "Am Dm", undefined)).toBe(false)
  })
})

describe("保存一覧の並び替え", () => {
  const old = saved({ id: "old", savedAt: "2026-01-01T00:00:00.000Z", key: "Em" })
  const edited = saved({ id: "edited", savedAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-03-01T00:00:00.000Z", key: "Am" })
  const recent = saved({ id: "recent", savedAt: "2026-02-01T00:00:00.000Z", key: "Dm" })

  it("新しい順は保存後の編集も新しさに含める", () => {
    expect(sortProgressions([old, recent, edited], "newest").map((p) => p.id)).toEqual(["edited", "recent", "old"])
  })

  it("古い順は保存日時、キー順はキー名で並べる", () => {
    expect(sortProgressions([recent, edited, old], "oldest").map((p) => p.id)).toEqual(["old", "edited", "recent"])
    expect(sortProgressions([old, recent, edited], "key").map((p) => p.key)).toEqual(["Am", "Dm", "Em"])
  })
})
