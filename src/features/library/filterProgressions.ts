import { lastModifiedAt, type SavedProgression } from "@/types/progression"

export type SortOrder = "newest" | "oldest" | "boutonnat" | "key"

export const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "newest", label: "新しい順" },
  { value: "oldest", label: "古い順" },
  { value: "boutonnat", label: "Craftスコア順" },
  { value: "key", label: "キー順" },
]

/** 検索語がコード名・度数・キー・メモ欄・フォルダ名のどれかに含まれるか(大文字小文字は区別しない) */
export function matchesQuery(p: SavedProgression, query: string, folderName: string | undefined): boolean {
  const q = query.trim().toLowerCase()
  if (q === "") return true
  const haystack = [
    p.chords.join(" "),
    p.romanNumerals.join(" "),
    p.key,
    p.memo,
    p.songIdea,
    p.arrangementNote,
    p.logicProNote,
    folderName ?? "",
  ]
    .join("\n")
    .toLowerCase()
  return q.split(/\s+/).every((word) => haystack.includes(word))
}

export function sortProgressions(list: SavedProgression[], order: SortOrder): SavedProgression[] {
  const sorted = [...list]
  if (order === "newest") sorted.sort((a, b) => lastModifiedAt(b).localeCompare(lastModifiedAt(a)))
  else if (order === "oldest") sorted.sort((a, b) => a.savedAt.localeCompare(b.savedAt))
  else if (order === "boutonnat") sorted.sort((a, b) => b.scores.boutonnat - a.scores.boutonnat)
  else sorted.sort((a, b) => a.key.localeCompare(b.key) || lastModifiedAt(b).localeCompare(lastModifiedAt(a)))
  return sorted
}
