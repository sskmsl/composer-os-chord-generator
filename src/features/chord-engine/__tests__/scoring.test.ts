import { describe, it, expect } from "vitest"
import { parseToken } from "../degrees"
import { computeScores, extractFeatures, type Features } from "../scoring"

const minorChain = (tokens: string[]) => extractFeatures(tokens.map(parseToken), "minor")
const majorChain = (tokens: string[]) => extractFeatures(tokens.map(parseToken), "major")

describe("detectCadence (via extractFeatures.cadence)", () => {
  it("detects an authentic cadence (V -> i)", () => {
    expect(minorChain(["i", "V", "i"]).cadence).toBe("authentic")
  })

  it("detects a half cadence when the progression ends on V", () => {
    expect(minorChain(["i", "V"]).cadence).toBe("half")
  })

  it("detects a deceptive cadence (V -> non-tonic)", () => {
    expect(minorChain(["i", "V", "bVI"]).cadence).toBe("deceptive")
  })

  it("detects a plagal cadence (iv -> i / IV -> I)", () => {
    expect(minorChain(["bVII", "iv", "i"]).cadence).toBe("plagal")
    expect(majorChain(["V", "IV", "I"]).cadence).toBe("plagal")
  })

  it("falls back to modal when neither dominant nor subdominant precedes the ending", () => {
    expect(minorChain(["i", "bVII"]).cadence).toBe("modal")
  })

  it("treats a single-chord progression as modal (no prior chord to relate to)", () => {
    expect(minorChain(["i"]).cadence).toBe("modal")
  })
})

describe("chromaticInnerSteps (nearest-neighbor half-step detection)", () => {
  it("counts a genuine half-step voice motion (i -> V: the 3rd steps down to a V tone)", () => {
    // Am(0,3,7) -> E(7,11,2)。上声のうち 3(短3度)が最近傍の 2 へ半音で降りる。
    expect(minorChain(["i", "V"]).chromaticInnerSteps).toBe(1)
  })

  it("does not flag a transition that is only a common-tone connection (i -> bVI)", () => {
    // Am(0,3,7) -> F(8,0,3)。3 と 0 は共通音として保持され、動いた声(7->8)は半音ではない
    expect(minorChain(["i", "bVI"]).chromaticInnerSteps).toBe(0)
  })

  it("does not false-positive on dense extended chords that merely share pitch-class proximity", () => {
    // i(add9) と bVImaj7 は共通音(3度・5度)を保ったまま接続し、残る声も半音ではない。
    // 旧ロジック(共通音を除外しない・最近傍でない任意ペア判定)ではここが誤検知していた。
    expect(minorChain(["i(add9)", "bVImaj7"]).chromaticInnerSteps).toBe(0)
  })
})

describe("extractFeatures basic detections", () => {
  it("detects augmented chords", () => {
    expect(minorChain(["i", "Vaug"]).hasAug).toBe(true)
    expect(minorChain(["i", "V"]).hasAug).toBe(false)
  })

  it("detects a borrowed bII (Neapolitan)", () => {
    expect(minorChain(["i", "bII", "V"]).hasBII).toBe(true)
  })

  it("marks a fully diatonic, undecorated, unslashed progression as plainDiatonic", () => {
    const f = minorChain(["i", "iv", "V", "i"])
    expect(f.plainDiatonic).toBe(true)
    expect(f.surpriseCount).toBe(0)
  })

  it("does not mark a progression with any color/borrowed/slash/pedal element as plainDiatonic", () => {
    expect(minorChain(["i(add9)", "iv", "V", "i"]).plainDiatonic).toBe(false)
    expect(minorChain(["i", "bII", "V", "i"]).plainDiatonic).toBe(false)
  })

  it("flags overDecorated when every chord is colored and there are 2+ surprises", () => {
    const f = minorChain(["i(add9)", "bIIadd9", "Vaug", "i(add9)"])
    expect(f.colorCount).toBe(4)
    expect(f.surpriseCount).toBeGreaterThanOrEqual(2)
    expect(f.overDecorated).toBe(true)
  })

  it("computes commonToneStrength as shared pitch classes per transition", () => {
    // i -> bVI は2つの共通音(3, 0)を持つ(degrees.test.ts で検証済みの構成に一致)
    expect(minorChain(["i", "bVI"]).commonToneStrength).toBe(2)
  })
})

describe("computeScores", () => {
  const baseFeatures: Features = {
    minor: true,
    hasDim: false,
    hasBII: false,
    hasV7: false,
    hasBVI: false,
    hasBVII: false,
    hasAug: false,
    hasBviBviiTonic: false,
    hasBorrowed: false,
    hasSlash: false,
    colorCount: 0,
    softColorCount: 0,
    descendingBass: false,
    ascendingBass: false,
    pedalBass: false,
    endsOnTonic: true,
    endsUnresolved: false,
    dominantPrep: false,
    largeArc: false,
    commonToneStrength: 0,
    chromaticInnerSteps: 0,
    surpriseCount: 0,
    plainDiatonic: true,
    overDecorated: false,
    cadence: "authentic",
  }

  it("clamps every score into the 1-10 range even for a maximally negative feature set", () => {
    const scores = computeScores(baseFeatures)
    for (const v of Object.values(scores)) {
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(10)
    }
  })

  it("clamps every score into the 1-10 range even for a maximally positive feature set", () => {
    const maxed: Features = {
      ...baseFeatures,
      hasDim: true,
      hasBII: true,
      hasV7: true,
      hasBVI: true,
      hasBVII: true,
      hasAug: true,
      hasBviBviiTonic: true,
      hasBorrowed: true,
      hasSlash: true,
      colorCount: 5,
      softColorCount: 5,
      descendingBass: true,
      pedalBass: true,
      endsUnresolved: true,
      dominantPrep: true,
      largeArc: true,
      commonToneStrength: 3,
      chromaticInnerSteps: 3,
      surpriseCount: 2,
      plainDiatonic: false,
      overDecorated: false,
    }
    const scores = computeScores(maxed)
    for (const v of Object.values(scores)) {
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(10)
    }
  })

  it("is deterministic: the same progression always gets the same scores", () => {
    const first = computeScores(baseFeatures)
    for (let i = 0; i < 50; i++) expect(computeScores(baseFeatures)).toEqual(first)
  })

  it("keeps a plain textbook progression in the lower half instead of inflating it", () => {
    const scores = computeScores(baseFeatures)
    expect(scores.boutonnat).toBeLessThanOrEqual(5)
    expect(scores.mylene).toBeLessThanOrEqual(5)
    expect(scores.cinematic).toBeLessThanOrEqual(5)
  })

  it("scores a plainDiatonic progression's boutonnat lower on average than a colorful one", () => {
    const colorful: Features = {
      ...baseFeatures,
      hasSlash: true,
      pedalBass: true,
      commonToneStrength: 1.5,
      chromaticInnerSteps: 1,
      hasBII: true,
      surpriseCount: 1,
      plainDiatonic: false,
    }
    const sample = (f: Features) => {
      const runs = Array.from({ length: 200 }, () =>
        computeScores(f).boutonnat,
      )
      return runs.reduce((a, b) => a + b, 0) / runs.length
    }
    expect(sample(colorful)).toBeGreaterThan(sample(baseFeatures))
  })
})
