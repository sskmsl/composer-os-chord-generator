// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ScoreBadge } from "../ScoreBadge"

const scores = { mylene: 7, boutonnat: 8, melancholy: 6, darkness: 5, cinematic: 4 }

describe("ScoreBadge", () => {
  it("renders the current display labels, not the retired artist names", () => {
    render(<ScoreBadge scores={scores} />)
    expect(screen.getByText("Atmosphere")).toBeTruthy()
    expect(screen.getByText("Craft")).toBeTruthy()
    expect(screen.queryByText(/Myl[eè]ne/i)).toBeNull()
    expect(screen.queryByText(/Boutonnat/i)).toBeNull()
  })

  it("renders every score's numeric value", () => {
    render(<ScoreBadge scores={scores} />)
    for (const value of Object.values(scores)) {
      expect(screen.getAllByText(String(value)).length).toBeGreaterThan(0)
    }
  })

  it("renders all 5 axis labels", () => {
    render(<ScoreBadge scores={scores} />)
    for (const label of ["Atmosphere", "Craft", "Melancholy", "Darkness", "Cinematic"]) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })
})
