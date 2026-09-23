import { beforeEach, describe, it, expect, vi } from "vitest"

vi.mock("@/features/exchange/composerSongExchange", () => ({
  downloadComposerSongExchange: vi.fn(),
}))
vi.mock("@/features/midi/exportSong", () => ({
  downloadSongSmf: vi.fn(),
}))
vi.mock("@/features/storage/backup", () => ({
  downloadBackup: vi.fn(),
  parseBackup: vi.fn(),
}))
vi.mock("@/features/storage/progressionRepository", () => ({
  folderRepository: {
    list: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    replaceAll: vi.fn().mockResolvedValue(undefined),
  },
  progressionRepository: {
    list: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    saveMany: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    replaceAll: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock("@/features/sync/supabaseSync", () => ({
  pushFolder: vi.fn().mockResolvedValue(undefined),
  pushProgression: vi.fn().mockResolvedValue(undefined),
}))

const { useAppStore } = await import("../useAppStore")
const { downloadBackup, parseBackup } = await import("@/features/storage/backup")
const { folderRepository, progressionRepository } = await import(
  "@/features/storage/progressionRepository"
)

const INITIAL_STATE = useAppStore.getState()

function fakeGenerated(id: string) {
  return {
    id,
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
    beats: [4, 4],
  }
}

beforeEach(() => {
  useAppStore.setState(INITIAL_STATE, true)
  vi.clearAllMocks()
})

describe("useAppStore: folders", () => {
  it("rejects an empty folder name", async () => {
    await expect(useAppStore.getState().createFolder("   ")).rejects.toThrow("フォルダ名を入力してください")
  })

  it("rejects a duplicate folder name", async () => {
    await useAppStore.getState().createFolder("My Song")
    await expect(useAppStore.getState().createFolder("My Song")).rejects.toThrow("同名のフォルダがあります")
  })

  it("creates a folder with updatedAt equal to createdAt and adds it to state", async () => {
    const folder = await useAppStore.getState().createFolder("My Song")
    expect(folder.updatedAt).toBe(folder.createdAt)
    expect(useAppStore.getState().folders).toContainEqual(folder)
  })

  it("bumps updatedAt (but not createdAt) when renaming a folder", async () => {
    const folder = await useAppStore.getState().createFolder("My Song")
    await new Promise((r) => setTimeout(r, 2))
    await useAppStore.getState().renameFolder(folder.id, "Renamed")
    const updated = useAppStore.getState().folders.find((f) => f.id === folder.id)
    expect(updated?.name).toBe("Renamed")
    expect(updated?.createdAt).toBe(folder.createdAt)
    expect(updated?.updatedAt).not.toBe(folder.createdAt)
  })

  it("throws when renaming a folder that does not exist", async () => {
    await expect(useAppStore.getState().renameFolder("nope", "X")).rejects.toThrow("フォルダが見つかりません")
  })
})

describe("useAppStore: saved progressions", () => {
  it("saves a generated progression and is idempotent for the same id", async () => {
    const generated = fakeGenerated("g1")
    await useAppStore.getState().saveProgression(generated)
    await useAppStore.getState().saveProgression(generated)
    expect(useAppStore.getState().saved.filter((p) => p.id === "g1")).toHaveLength(1)
    expect(progressionRepository.save).toHaveBeenCalledTimes(1)
  })

  it("removes a progression on delete", async () => {
    await useAppStore.getState().saveProgression(fakeGenerated("g1"))
    await useAppStore.getState().deleteSaved("g1")
    expect(useAppStore.getState().saved.find((p) => p.id === "g1")).toBeUndefined()
  })
})

describe("useAppStore: backup and restore", () => {
  it("restoreFromBackup replaces local state with the parsed backup contents", async () => {
    const folder = {
      id: "f1", name: "Song", createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z",
    }
    const progression = { ...fakeGenerated("p1"), schemaVersion: 5, memo: "", songIdea: "", arrangementNote: "", logicProNote: "", savedAt: "2024-01-01T00:00:00.000Z", folderId: "f1", order: 1, repeatCount: 1 }
    vi.mocked(parseBackup).mockReturnValue({ folders: [folder], progressions: [progression] })

    await useAppStore.getState().restoreFromBackup("{}")

    expect(folderRepository.replaceAll).toHaveBeenCalledWith([folder])
    expect(progressionRepository.replaceAll).toHaveBeenCalledWith([progression])
    expect(useAppStore.getState().folders).toEqual([folder])
    expect(useAppStore.getState().saved).toEqual([progression])
  })

  it("propagates a parseBackup validation error without touching local state", async () => {
    vi.mocked(parseBackup).mockImplementation(() => {
      throw new Error("バックアップファイルの形式が正しくありません")
    })
    await expect(useAppStore.getState().restoreFromBackup("garbage")).rejects.toThrow(
      "バックアップファイルの形式が正しくありません",
    )
    expect(folderRepository.replaceAll).not.toHaveBeenCalled()
  })

  it("exportAllAsBackup passes the current folders/saved to downloadBackup", () => {
    useAppStore.getState().exportAllAsBackup()
    expect(downloadBackup).toHaveBeenCalledWith(useAppStore.getState().folders, useAppStore.getState().saved)
  })
})

describe("useAppStore: generator history", () => {
  it("restorePrevious swaps back to the prior result set", () => {
    const original = [fakeGenerated("a")]
    useAppStore.setState({ results: original, previousResults: null })
    useAppStore.getState().generate()
    const afterGenerate = useAppStore.getState().results
    useAppStore.getState().restorePrevious()
    expect(useAppStore.getState().results).toBe(original)
    expect(useAppStore.getState().previousResults).toBe(afterGenerate)
  })
})
