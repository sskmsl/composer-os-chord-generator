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
  clearRemoteDeletions: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/features/storage/deletionRepository", () => ({
  deletionRepository: {
    list: vi.fn().mockResolvedValue([]),
    record: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    replaceAll: vi.fn().mockResolvedValue(undefined),
  },
}))

const { useAppStore } = await import("../useAppStore")
const { downloadBackup, parseBackup } = await import("@/features/storage/backup")
const { folderRepository, progressionRepository } = await import(
  "@/features/storage/progressionRepository"
)
const { deletionRepository } = await import("@/features/storage/deletionRepository")
const { clearRemoteDeletions } = await import("@/features/sync/supabaseSync")

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

describe("useAppStore: 取り消し(元に戻す)", () => {
  it("コードの書き換えを取り消すと、直前の内容を今の時刻で保存し直す", async () => {
    await useAppStore.getState().saveProgression(fakeGenerated("g1"))
    const token = await useAppStore.getState().updateSaved("g1", { chords: ["Dm", "E7"] })
    expect(await useAppStore.getState().undo(token)).toBe(true)
    const restored = useAppStore.getState().saved.find((p) => p.id === "g1")
    expect(restored?.chords).toEqual(["Am", "F"])
    // 同期で「新しい方」として残るよう、戻した時刻を編集日時にする
    expect(restored?.updatedAt).toBeDefined()
    expect(progressionRepository.saveMany).toHaveBeenCalledWith([expect.objectContaining({ id: "g1", chords: ["Am", "F"] })])
  })

  it("削除を取り消すと進行が戻り、削除の記録も消す", async () => {
    await useAppStore.getState().saveProgression(fakeGenerated("g1"))
    const token = await useAppStore.getState().deleteSaved("g1")
    expect(useAppStore.getState().saved.find((p) => p.id === "g1")).toBeUndefined()
    await useAppStore.getState().undo(token)
    expect(useAppStore.getState().saved.find((p) => p.id === "g1")).toBeDefined()
    expect(deletionRepository.clear).toHaveBeenCalledWith(["g1"])
    expect(clearRemoteDeletions).toHaveBeenCalledWith(["g1"])
  })

  it("フォルダの削除を取り消すと、フォルダと中の進行の所属が戻る", async () => {
    const folder = await useAppStore.getState().createFolder("My Song")
    useAppStore.getState().setSaveTargetFolder(folder.id)
    await useAppStore.getState().saveProgression(fakeGenerated("g1"))
    const token = await useAppStore.getState().deleteFolder(folder.id)
    expect(useAppStore.getState().saved.find((p) => p.id === "g1")?.folderId).toBeNull()
    await useAppStore.getState().undo(token)
    expect(useAppStore.getState().folders.map((f) => f.id)).toContain(folder.id)
    expect(useAppStore.getState().saved.find((p) => p.id === "g1")?.folderId).toBe(folder.id)
  })

  it("コードの書き換えを戻しても、その後に編集したメモは残す(変わった項目だけを戻す)", async () => {
    await useAppStore.getState().saveProgression(fakeGenerated("g1"))
    const token = await useAppStore.getState().updateSaved("g1", { chords: ["Dm", "E7"] })
    await useAppStore.getState().updateSaved("g1", { memo: "後から書いたメモ" })
    await useAppStore.getState().undo(token)
    const p = useAppStore.getState().saved.find((x) => x.id === "g1")
    expect(p?.chords).toEqual(["Am", "F"])
    expect(p?.memo).toBe("後から書いたメモ")
  })

  it("操作履歴は新しい順に並び、最後の操作から戻せる(並べ替え・複製・メモも対象)", async () => {
    const folder = await useAppStore.getState().createFolder("Song")
    useAppStore.getState().setSaveTargetFolder(folder.id)
    await useAppStore.getState().saveProgression(fakeGenerated("a"))
    await useAppStore.getState().saveProgression(fakeGenerated("b"))
    const orderOf = (id: string) => useAppStore.getState().saved.find((p) => p.id === id)!.order
    const before = { a: orderOf("a"), b: orderOf("b") }
    await useAppStore.getState().reorderSection("b", before.b > before.a ? "up" : "down")
    const copy = await useAppStore.getState().duplicateSection("a")
    await useAppStore.getState().updateSaved("a", { memo: "メモ" })

    expect(useAppStore.getState().undoHistory.map((h) => h.label.replace(/\(.*$/, ""))).toEqual([
      "メモを編集",
      "セクションを複製",
      "セクションを並べ替え",
    ])
    expect(await useAppStore.getState().undoLatest()).toMatch(/^メモを編集/)
    expect(useAppStore.getState().saved.find((p) => p.id === "a")?.memo).toBe("")
    expect(await useAppStore.getState().undoLatest()).toBe("セクションを複製")
    expect(useAppStore.getState().saved.find((p) => p.id === copy.id)).toBeUndefined()
    expect(await useAppStore.getState().undoLatest()).toBe("セクションを並べ替え")
    expect({ a: orderOf("a"), b: orderOf("b") }).toEqual(before)
    expect(await useAppStore.getState().undoLatest()).toBeNull()
  })

  it("操作履歴は30件まで。古い記録は取り消せなくなる", async () => {
    await useAppStore.getState().saveProgression(fakeGenerated("g1"))
    const first = await useAppStore.getState().updateSaved("g1", { memo: "0" })
    for (let i = 1; i <= 30; i++) await useAppStore.getState().updateSaved("g1", { memo: String(i) })
    expect(useAppStore.getState().undoHistory).toHaveLength(30)
    expect(await useAppStore.getState().undo(first)).toBe(false)
  })

  it("同じ取り消しは1回だけ。知らないトークンは false", async () => {
    await useAppStore.getState().saveProgression(fakeGenerated("g1"))
    const token = await useAppStore.getState().updateSaved("g1", { memo: "x" })
    expect(await useAppStore.getState().undo(token)).toBe(true)
    expect(await useAppStore.getState().undo(token)).toBe(false)
    expect(await useAppStore.getState().undo("unknown")).toBe(false)
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
    // 復元した項目は意図して戻したものなので、削除の記録を解除する(次の同期で消えないように)
    expect(deletionRepository.clear).toHaveBeenCalledWith(["f1", "p1"])
    expect(clearRemoteDeletions).toHaveBeenCalledWith(["f1", "p1"])
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
