import { describe, it, expect } from "vitest"
import { createFolder, migrateFolder, type Folder } from "../folder"

describe("createFolder", () => {
  it("sets updatedAt equal to createdAt for a brand new folder", () => {
    const folder = createFolder("My Song")
    expect(folder.updatedAt).toBe(folder.createdAt)
  })

  it("trims the name", () => {
    expect(createFolder("  My Song  ").name).toBe("My Song")
  })
})

describe("migrateFolder", () => {
  it("defaults updatedAt to createdAt when missing (legacy pre-updatedAt data)", () => {
    const legacy = { id: "f1", name: "Old Song", createdAt: "2023-01-01T00:00:00.000Z" } as Partial<Folder>
    const migrated = migrateFolder(legacy as Folder)
    expect(migrated.updatedAt).toBe("2023-01-01T00:00:00.000Z")
  })

  it("does not touch an already-present updatedAt", () => {
    const folder: Folder = {
      id: "f1",
      name: "Song",
      createdAt: "2023-01-01T00:00:00.000Z",
      updatedAt: "2024-06-01T00:00:00.000Z",
    }
    expect(migrateFolder(folder).updatedAt).toBe("2024-06-01T00:00:00.000Z")
  })
})
