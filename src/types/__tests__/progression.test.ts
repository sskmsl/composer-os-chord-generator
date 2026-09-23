import { describe, it, expect } from "vitest"
import { migrateSavedProgression, toSavedProgression, PROGRESSION_SCHEMA_VERSION, type SavedProgression } from "../progression"

function legacyV3Progression(): SavedProgression {
  // v3相当: folderId/order/repeatCountまではあるが、schemaVersion正規化前のsectionと
  // beatsフィールドが存在しない、実際に保存されていそうな古いデータを模す
  return {
    id: "legacy-1",
    chords: ["Am", "F", "C", "G"],
    key: "Am",
    mode: "minor",
    style: "romanticDark",
    // v3以前の値。normalizeSectionRoleで "verse" へ正規化されるはず
    section: "verse1" as unknown as SavedProgression["section"],
    mood: "melancholic",
    romanNumerals: ["i", "bVI", "bIII", "bVII"],
    bassMovement: "A -> F -> C -> G(起伏型)",
    description: "legacy",
    scores: { mylene: 5, boutonnat: 5, melancholy: 5, darkness: 5, cinematic: 5 },
    createdAt: "2023-01-01T00:00:00.000Z",
    // beats はまだ存在しない世代を模すため意図的に省略(as unknown で型を通す)
    schemaVersion: 3,
    memo: "",
    songIdea: "",
    arrangementNote: "",
    logicProNote: "",
    savedAt: "2023-01-01T00:00:00.000Z",
    folderId: null,
    order: 1672531200000,
    repeatCount: 1,
  } as unknown as SavedProgression
}

describe("migrateSavedProgression", () => {
  it("defaults beats to a uniform 4 per chord when missing (preserves the old fixed-rhythm sound)", () => {
    const migrated = migrateSavedProgression(legacyV3Progression())
    expect(migrated.beats).toEqual([4, 4, 4, 4])
  })

  it("maps the removed Symphonic Rock style to a current style so playback/MIDI keep working", () => {
    const raw = { ...legacyV3Progression(), style: "symphonicRock" } as unknown as SavedProgression
    expect(migrateSavedProgression(raw).style).toBe("cinematic")
  })

  it("keeps a current style as is", () => {
    expect(migrateSavedProgression(legacyV3Progression()).style).toBe("romanticDark")
  })

  it("bumps schemaVersion to the current version", () => {
    const migrated = migrateSavedProgression(legacyV3Progression())
    expect(migrated.schemaVersion).toBe(PROGRESSION_SCHEMA_VERSION)
  })

  it("normalizes a legacy section value", () => {
    const migrated = migrateSavedProgression(legacyV3Progression())
    expect(migrated.section).toBe("verse")
  })

  it("does not touch an already-present beats array", () => {
    const raw = { ...legacyV3Progression(), beats: [4, 2, 4, 8] }
    const migrated = migrateSavedProgression(raw)
    expect(migrated.beats).toEqual([4, 2, 4, 8])
  })

  it("is idempotent: migrating an already-current-version progression is a no-op on beats", () => {
    const once = migrateSavedProgression(legacyV3Progression())
    const twice = migrateSavedProgression(once)
    expect(twice.beats).toEqual(once.beats)
    expect(twice.schemaVersion).toBe(once.schemaVersion)
  })
})

describe("toSavedProgression", () => {
  it("carries the beats field through from the generated progression", () => {
    const generated = {
      id: "g1",
      chords: ["Am", "F"],
      key: "Am",
      mode: "minor" as const,
      style: "romanticDark" as const,
      section: "verse" as const,
      mood: "melancholic" as const,
      romanNumerals: ["i", "bVI"],
      bassMovement: "test",
      description: "test",
      scores: { mylene: 5, boutonnat: 5, melancholy: 5, darkness: 5, cinematic: 5 },
      createdAt: new Date().toISOString(),
      beats: [4, 8],
    }
    const saved = toSavedProgression(generated, null)
    expect(saved.beats).toEqual([4, 8])
    expect(saved.schemaVersion).toBe(PROGRESSION_SCHEMA_VERSION)
  })
})
