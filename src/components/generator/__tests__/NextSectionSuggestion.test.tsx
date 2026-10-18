// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

vi.mock("@/features/storage/feedbackRepository", () => ({
  feedbackRepository: { recordShown: vi.fn().mockResolvedValue(undefined), list: vi.fn().mockResolvedValue([]) },
}))
vi.mock("@/features/chord-engine/generateProgressions", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/chord-engine/generateProgressions")>()
  return { ...original, generateProgressions: vi.fn(original.generateProgressions) }
})

const { useAppStore } = await import("@/store/useAppStore")
const { generateProgressions } = await import("@/features/chord-engine/generateProgressions")
const { NextSectionSuggestion } = await import("../NextSectionSuggestion")

const INITIAL_STATE = useAppStore.getState()
const chorusResult = {
  id: "chorus-1",
  chords: ["G", "Am", "C", "F"],
  key: "Am",
  mode: "minor" as const,
  style: "cinematic" as const,
  section: "chorus" as const,
  mood: "dramatic" as const,
  romanNumerals: ["bVII", "i", "bIII", "bVI"],
  bassMovement: "test",
  description: "test",
  scores: { mylene: 5, boutonnat: 5, melancholy: 5, darkness: 5, cinematic: 5 },
  createdAt: new Date().toISOString(),
  beats: [4, 4, 4, 4],
}

beforeEach(() => {
  useAppStore.setState(INITIAL_STATE, true)
  useAppStore.setState({
    params: { ...INITIAL_STATE.params, style: "cinematic", section: "chorus", length: 4, key: { tonic: "A", mode: "minor" } },
    results: [chorusResult],
  })
  vi.clearAllMocks()
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})

describe("NextSectionSuggestion: key moves reach the generator", () => {
  it("shows the 3-semitone-down key on the bridge suggestion and generates in that key with the previous loop", () => {
    render(<NextSectionSuggestion />)
    expect(screen.getByText("Key: F#m")).toBeTruthy()
    const bridgeButton = screen.getAllByRole("button").find((b) => /^(Bridge|ブリッジ) を生成/.test(b.textContent ?? ""))
    fireEvent.click(bridgeButton!)
    const call = vi.mocked(generateProgressions).mock.lastCall![0]
    expect(call.section).toBe("bridge")
    expect(call.key).toEqual({ tonic: "F#", mode: "minor" })
    expect(call.previous?.loop).toEqual(["bVII", "i", "bIII", "bVI"])
    expect(call.originalKey).toEqual({ tonic: "A", mode: "minor" })
  })

  it("offers the return to the original key from the c-melody after a move", () => {
    useAppStore.setState({
      params: { ...useAppStore.getState().params, section: "c-melody", key: { tonic: "F#", mode: "minor" } },
      songContext: { originalKey: { tonic: "A", mode: "minor" } },
    })
    render(<NextSectionSuggestion />)
    expect(screen.getByText("Key: Am")).toBeTruthy()
    const chorusButton = screen.getAllByRole("button").find((b) => b.textContent?.startsWith("サビ を生成"))
    fireEvent.click(chorusButton!)
    expect(useAppStore.getState().params.key).toEqual({ tonic: "A", mode: "minor" })
    expect(vi.mocked(generateProgressions).mock.lastCall![0].section).toBe("chorus")
  })

  it("does not show a key change when the key is already the original", () => {
    useAppStore.setState({ params: { ...useAppStore.getState().params, section: "c-melody" } })
    render(<NextSectionSuggestion />)
    expect(screen.queryByText(/^Key: /)).toBeTruthy() // the up move to the grand chorus still changes the key
    expect(screen.queryByText("Key: Am")).toBeNull()
  })
})

describe("NextSectionSuggestion: temporary darkening", () => {
  const majorResult = { ...chorusResult, key: "C", mode: "major" as const, romanNumerals: ["I", "vi", "IV", "V"], chords: ["C", "Am", "F", "G"] }

  it("offers the same-tonic minor for the soft chorus in a major song, and generates there from the major loop", () => {
    useAppStore.setState({
      params: { ...useAppStore.getState().params, key: { tonic: "C", mode: "major" }, section: "chorus" },
      results: [majorResult],
    })
    render(<NextSectionSuggestion />)
    expect(screen.getByText("Key: Cm")).toBeTruthy()
    const button = screen.getAllByRole("button").find((b) => b.textContent?.startsWith("落ちサビ を生成"))
    fireEvent.click(button!)
    const call = vi.mocked(generateProgressions).mock.lastCall![0]
    expect(call.key).toEqual({ tonic: "C", mode: "minor" })
    expect(call.previous?.key).toEqual({ tonic: "C", mode: "major" })
    expect(call.originalKey).toEqual({ tonic: "C", mode: "major" })
  })

  it("does not offer a key change for a minor song", () => {
    render(<NextSectionSuggestion />)
    const button = screen.getAllByRole("button").find((b) => b.textContent?.startsWith("落ちサビ を生成"))
    expect(button?.textContent).not.toMatch(/Key:/)
  })
})
