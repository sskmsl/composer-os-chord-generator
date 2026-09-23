import { describe, it, expect } from "vitest"
import { mergeById } from "../supabaseSync"

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
