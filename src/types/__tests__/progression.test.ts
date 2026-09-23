import { describe, it, expect } from "vitest"
import {
  alignBeatsToBars,
  lastModifiedAt,
  migrateSavedProgression,
  toSavedProgression,
  PROGRESSION_SCHEMA_VERSION,
  type SavedProgression,
} from "../progression"

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

  it("does not touch an already-present, bar-aligned beats array", () => {
    const raw = { ...legacyV3Progression(), beats: [2, 2, 4, 8] }
    const migrated = migrateSavedProgression(raw)
    expect(migrated.beats).toEqual([2, 2, 4, 8])
  })

  it("re-aligns a saved rhythm that ends mid-bar (4+2+4+8 = 18 beats → 16)", () => {
    const raw = { ...legacyV3Progression(), beats: [4, 2, 4, 8] }
    expect(migrateSavedProgression(raw).beats).toEqual([2, 2, 4, 8])
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

describe("alignBeatsToBars", () => {
  it("pairs a lone 2-beat passing chord with the chord before it so the section stays bar-aligned", () => {
    // C(4) G/B(2) Am(4) F(4) = 14拍 → C(2) G/B(2) | Am | F = 12拍
    expect(alignBeatsToBars([4, 2, 4, 4])).toEqual([2, 2, 4, 4])
  })

  it("keeps two consecutive 2-beat chords as one shared bar", () => {
    expect(alignBeatsToBars([4, 2, 2, 4])).toEqual([4, 2, 2, 4])
  })

  it("pairs with the following chord when the previous one is already paired, but never shortens the landing chord", () => {
    expect(alignBeatsToBars([2, 2, 2, 4, 4])).toEqual([2, 2, 2, 2, 4])
    expect(alignBeatsToBars([2, 2, 2, 8])).toEqual([2, 2, 4, 8])
  })

  it("leaves already-aligned rhythms untouched (idempotent)", () => {
    for (const beats of [[4, 4, 4, 4], [2, 2, 4, 8], [4, 2, 2, 4, 8]]) {
      expect(alignBeatsToBars(beats)).toEqual(beats)
    }
  })

  it("always yields a multiple of 4 beats in total", () => {
    for (const beats of [[2], [4, 2], [2, 4, 2, 4, 2], [3, 4], [4, 2, 8]]) {
      expect(alignBeatsToBars(beats).reduce((a, b) => a + b, 0) % 4).toBe(0)
    }
  })
})

describe("lastModifiedAt(同期で新しい方を残す基準)", () => {
  it("保存後に編集していれば編集日時、していなければ保存日時", () => {
    expect(lastModifiedAt({ savedAt: "2026-01-01T00:00:00.000Z" })).toBe("2026-01-01T00:00:00.000Z")
    expect(lastModifiedAt({ savedAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" })).toBe(
      "2026-02-01T00:00:00.000Z",
    )
    // 複製直後など、編集日時が保存日時より古い場合は保存日時
    expect(lastModifiedAt({ savedAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" })).toBe(
      "2026-03-01T00:00:00.000Z",
    )
  })
})
