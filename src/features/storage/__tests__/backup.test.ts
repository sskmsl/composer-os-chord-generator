import { describe, it, expect } from "vitest"
import { buildBackup, parseBackup, BACKUP_FORMAT, BACKUP_VERSION } from "../backup"
import type { Folder } from "@/types/folder"
import type { SavedProgression } from "@/types/progression"

const folder: Folder = {
  id: "f1",
  name: "Test Song",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
}

const progression: SavedProgression = {
  id: "p1",
  chords: ["Am", "F"],
  key: "Am",
  mode: "minor",
  style: "romanticDark",
  section: "verse",
  mood: "melancholic",
  romanNumerals: ["i", "bVI"],
  bassMovement: "test",
  description: "test",
  scores: { mylene: 5, boutonnat: 5, melancholy: 5, darkness: 5, cinematic: 5 },
  createdAt: "2024-01-01T00:00:00.000Z",
  beats: [4, 4],
  schemaVersion: 5,
  memo: "",
  songIdea: "",
  arrangementNote: "",
  logicProNote: "",
  savedAt: "2024-01-01T00:00:00.000Z",
  folderId: "f1",
  order: 1,
  repeatCount: 1,
}

describe("buildBackup / parseBackup round-trip", () => {
  it("round-trips folders and progressions through JSON", () => {
    const backup = buildBackup([folder], [progression])
    const restored = parseBackup(JSON.stringify(backup))
    expect(restored.folders).toEqual([folder])
    expect(restored.progressions).toEqual([progression])
  })

  it("stamps the current format and version", () => {
    const backup = buildBackup([], [])
    expect(backup.format).toBe(BACKUP_FORMAT)
    expect(backup.version).toBe(BACKUP_VERSION)
  })
})

describe("parseBackup validation", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseBackup("not json")).toThrow()
  })

  it("rejects a file missing the expected format tag", () => {
    expect(() => parseBackup(JSON.stringify({ folders: [], progressions: [] }))).toThrow()
  })

  it("rejects a file where folders/progressions are not arrays", () => {
    expect(() =>
      parseBackup(JSON.stringify({ format: BACKUP_FORMAT, folders: {}, progressions: [] })),
    ).toThrow()
  })

  it("migrates legacy (pre-beats) saved progressions found inside an old backup", () => {
    const legacy = { ...progression } as Partial<SavedProgression>
    delete legacy.beats
    const backup = { format: BACKUP_FORMAT, version: 1, exportedAt: "x", folders: [folder], progressions: [legacy] }
    const restored = parseBackup(JSON.stringify(backup))
    expect(restored.progressions[0].beats).toEqual([4, 4])
  })

  it("migrates legacy (pre-updatedAt) folders found inside an old backup", () => {
    const legacy = { ...folder } as Partial<Folder>
    delete legacy.updatedAt
    const backup = { format: BACKUP_FORMAT, version: 1, exportedAt: "x", folders: [legacy], progressions: [progression] }
    const restored = parseBackup(JSON.stringify(backup))
    expect(restored.folders[0].updatedAt).toBe(folder.createdAt)
  })
})
