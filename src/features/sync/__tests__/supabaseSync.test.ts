import { describe, it, expect } from "vitest"
import { applyTombstones, mergeById, mergeTombstones } from "../supabaseSync"

interface Item {
  id: string
  savedAt: string
  label: string
}

const item = (id: string, savedAt: string, label: string): Item => ({ id, savedAt, label })

describe("mergeById", () => {
  it("keeps items that exist only locally (never silently drops unsynced local data)", () => {
    const local = [item("a", "2024-01-01", "local-only")]
    const remote: Item[] = []
    const merged = mergeById(local, remote, (l, r) => r.savedAt >= l.savedAt)
    expect(merged).toEqual(local)
  })

  it("keeps items that exist only remotely (other devices' work is not lost)", () => {
    const local: Item[] = []
    const remote = [item("a", "2024-01-01", "remote-only")]
    const merged = mergeById(local, remote, (l, r) => r.savedAt >= l.savedAt)
    expect(merged).toEqual(remote)
  })

  it("keeps the local version when it is strictly newer than the remote version", () => {
    const local = [item("a", "2024-06-01", "local-newer")]
    const remote = [item("a", "2024-01-01", "remote-older")]
    const merged = mergeById(local, remote, (l, r) => r.savedAt >= l.savedAt)
    expect(merged).toEqual([item("a", "2024-06-01", "local-newer")])
  })

  it("keeps the remote version when it is newer than or equal to the local version", () => {
    const local = [item("a", "2024-01-01", "local-older")]
    const remote = [item("a", "2024-06-01", "remote-newer")]
    const merged = mergeById(local, remote, (l, r) => r.savedAt >= l.savedAt)
    expect(merged).toEqual([item("a", "2024-06-01", "remote-newer")])
  })

  it("supports an always-prefer-remote comparator for data without timestamps (folders)", () => {
    const local = [item("a", "", "local-version"), item("b", "", "local-only")]
    const remote = [item("a", "", "remote-version")]
    const merged = mergeById(local, remote, () => true)
    expect(merged).toContainEqual(item("a", "", "remote-version"))
    expect(merged).toContainEqual(item("b", "", "local-only"))
    expect(merged).toHaveLength(2)
  })
})

describe("applyTombstones(削除の同期)", () => {
  const tomb = (id: string, deletedAt: string) => ({ id, kind: "progression" as const, deletedAt })

  it("別端末で削除された項目は、この端末に古いコピーが残っていても落とす", () => {
    const items = [item("a", "2026-01-01", "old copy"), item("b", "2026-01-01", "kept")]
    const result = applyTombstones(items, [tomb("a", "2026-02-01")], (i) => i.savedAt)
    expect(result.map((i) => i.id)).toEqual(["b"])
  })

  it("削除より後に保存し直された項目は残す(作り直し・復元)", () => {
    const items = [item("a", "2026-03-01", "re-saved")]
    expect(applyTombstones(items, [tomb("a", "2026-02-01")], (i) => i.savedAt)).toEqual(items)
  })

  it("削除の記録が無い項目(未同期のローカルの新しい保存)には触れない", () => {
    const items = [item("new", "2026-05-01", "unsynced local")]
    expect(applyTombstones(items, [tomb("other", "2026-06-01")], (i) => i.savedAt)).toEqual(items)
  })
})

describe("mergeTombstones", () => {
  it("同じidは新しい削除時刻を残し、保持期間を過ぎた記録は捨てる", () => {
    const now = new Date("2026-09-23T00:00:00.000Z")
    const merged = mergeTombstones(
      [{ id: "a", kind: "progression", deletedAt: "2026-09-01T00:00:00.000Z" }, { id: "old", kind: "folder", deletedAt: "2026-01-01T00:00:00.000Z" }],
      [{ id: "a", kind: "progression", deletedAt: "2026-09-10T00:00:00.000Z" }],
      now,
    )
    expect(merged).toEqual([{ id: "a", kind: "progression", deletedAt: "2026-09-10T00:00:00.000Z" }])
  })
})
