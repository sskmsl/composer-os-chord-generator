import type { Mode, MoodId, StyleId } from "@/types/music"

/**
 * スタイル別コード進行テンプレート(CHORD_ENGINE_SPEC §5 のディグリー表記)。
 * マイナーは仕様のテンプレートをそのまま採用。
 * メジャーは仕様§3のメジャー語彙(I, Iadd9, Imaj7, ii7, iii, IVmaj7, V,
 * Vsus4, vi(add9), bVII, 借用iv)から各スタイルの性格に合わせて構成した。
 */
export const STYLE_TEMPLATES: Record<StyleId, Record<Mode, string[][]>> = {
  ethereal: {
    minor: [
      ["i(add9)", "bVIImaj7", "bVIadd9", "bIII/V"],
      ["i(add9)", "bVII", "bVImaj7", "Vsus4"],
      ["i11", "bVImaj7/i", "ivm9", "Vsus4"],
      ["i(add9)", "bIIImaj7", "bVIadd9", "bVII"],
    ],
    major: [
      ["Iadd9", "IVmaj7", "vi(add9)", "Vsus4"],
      ["Imaj7", "vi(add9)", "IVmaj7", "Vsus4"],
      ["Iadd9", "bVII", "IVmaj7", "Iadd9"],
      ["Iadd9", "iii", "IVmaj7", "Vsus4"],
    ],
  },
  romanticDark: {
    minor: [
      ["i(add9)", "bVImaj7", "ivm9", "V7sus4"],
      ["i", "#ivdim", "bVImaj7", "V"],
      ["i(add9)", "bVII", "bVI", "V7"],
      ["i", "ivm9", "bVImaj7", "V7sus4"],
    ],
    major: [
      ["vi(add9)", "IVmaj7", "ii7", "V7sus4"],
      ["I", "iv", "IVmaj7", "I"],
      ["vi", "IVmaj7", "iv", "V7"],
      ["Imaj7", "vi(add9)", "iv", "Vsus4"],
    ],
  },
  cinematic: {
    minor: [
      ["i(add9)", "bVImaj7", "bIII", "bVII"],
      ["bVImaj7", "bVII", "i", "Vsus4"],
      ["i", "bIII", "bVI", "V"],
      ["ivm9", "bVImaj7", "bVII", "i(add9)"],
    ],
    major: [
      ["I", "bVII", "IVmaj7", "I"],
      ["IVmaj7", "V", "vi(add9)", "I"],
      ["I", "iii", "IVmaj7", "Vsus4"],
      ["vi(add9)", "IVmaj7", "V", "I"],
    ],
  },
  newWave: {
    minor: [
      ["i", "bVII", "bVI", "bVII"],
      ["i", "bVI", "bIII", "bVII"],
      ["i(add9)", "bVII", "iv", "bVI"],
      ["i", "bIII", "bVII", "bVI"],
    ],
    major: [
      ["I", "V", "vi", "IV"],
      ["I", "bVII", "IV", "I"],
      ["vi", "IV", "I", "V"],
      ["I", "iii", "vi", "IV"],
    ],
  },
  symphonicRock: {
    minor: [
      ["i", "bVI", "bIII", "bVII"],
      ["i", "V", "bVI", "bVII"],
      ["i(add9)", "bVImaj7", "V", "i"],
      ["bVI", "bVII", "i", "i"],
    ],
    major: [
      ["I", "V", "vi", "iv"],
      ["vi", "IV", "V", "I"],
      ["I", "bVII", "IV", "V"],
      ["IV", "V", "vi", "I"],
    ],
  },
  ritual: {
    minor: [
      ["i", "i(add9)", "bII", "i"],
      ["i", "bVII", "i", "bVI"],
      ["i(add9)", "ivsus2", "i", "bVII"],
      ["i", "bVI", "i", "bII"],
    ],
    major: [
      ["I", "Iadd9", "bVII", "I"],
      ["I", "bVII", "I", "IV"],
      ["Iadd9", "IVsus2", "I", "bVII"],
      ["I", "iv", "I", "bVII"],
    ],
  },
  finale: {
    minor: [
      ["bVI", "bVII", "i", "bIII"],
      ["i", "bVI", "bVII", "i"],
      ["bVImaj7", "bVII", "i(add9)", "i"],
      ["i", "bIII", "bVI", "bVII"],
    ],
    major: [
      ["IV", "V", "vi", "I"],
      ["I", "IV", "V", "I"],
      ["IVmaj7", "V", "Iadd9", "I"],
      ["I", "vi", "IV", "V"],
    ],
  },
  cool: {
    minor: [
      ["i7", "iv7", "bVII", "i7"],
      ["im9", "iv7", "bVII7", "bVI"],
      ["i7", "bIII", "iv7", "bVII7"],
      ["i", "bVI", "bVII7", "i7"],
    ],
    major: [
      ["I6", "vi7", "ii7", "V7"],
      ["I", "bVII", "IV", "I"],
      ["vi7", "IV6", "I", "V7"],
      ["I6", "IV", "bVII", "I"],
    ],
  },
  tripHop: {
    minor: [
      ["i7", "bVII7", "i7", "bVII7"],
      ["im9", "iv7", "im9", "iv7"],
      ["i7", "iv7", "bVII7", "i7"],
      ["i", "bVI", "i", "bVI"],
    ],
    major: [
      ["vi7", "IV6", "vi7", "IV6"],
      ["I", "bVII", "I", "bVII"],
      ["vi7", "bVII", "vi7", "IV"],
      ["I6", "bVII", "IV6", "I6"],
    ],
  },
  neoclassical: {
    minor: [
      ["i", "iiø", "V7", "i"],
      ["i(add9)", "#ivdim", "bVImaj7/i", "V7sus4"],
      ["i", "bVII/i", "bVI/i", "V7"],
      ["i", "iv/bVI", "V7sus4", "i"],
    ],
    major: [
      ["I", "iiø", "V7", "I"],
      ["Iadd9", "#ivdim", "vi/I", "V7sus4"],
      ["I", "bVII/I", "IV/I", "V7"],
      ["I", "iv/bVI", "V7sus4", "I"],
    ],
  },
  minimalism: {
    minor: [
      ["i", "bVI", "bVII", "i"],
      ["i", "iv", "i", "iv"],
      ["i", "bVII", "i", "bVII"],
      ["i", "bIII", "iv", "bVII"],
    ],
    major: [
      ["I", "bVI", "bVII", "I"],
      ["I", "IV", "I", "IV"],
      ["I", "bVII", "I", "bVII"],
      ["I", "iii", "IV", "bVII"],
    ],
  },
  jChanson: {
    minor: [
      ["i", "bII", "V7", "i"],
      ["i7", "iv7", "bVII7", "bIIImaj7"],
      ["i", "iiø", "bII", "V7"],
      ["i(add9)", "bVImaj7", "V7sus4", "i"],
    ],
    major: [
      ["I", "bII", "V7", "I"],
      ["Imaj7", "vi7", "ii7", "V7"],
      ["Imaj7", "bIIImaj7", "IV", "V7"],
      ["I", "bVI", "V7", "I"],
    ],
  },
  hiNRG: {
    minor: [
      ["i", "bVI", "bVII", "V7"],
      ["i", "v", "bVI", "bVII"],
      ["i", "bIII", "bVII", "V7"],
      ["i", "iv", "V7", "i"],
    ],
    major: [
      ["I", "vi", "IV", "V7"],
      ["I", "V", "vi", "IV"],
      ["vi", "IV", "I", "V7"],
      ["I", "bVII", "IV", "V7"],
    ],
  },
}

/** スタイルごとの標準テンポ(BPM)。試聴とMIDI書き出しのデフォルトに使う */
export const STYLE_TEMPO: Record<StyleId, number> = {
  ethereal: 76,
  romanticDark: 84,
  cinematic: 80,
  newWave: 112,
  symphonicRock: 96,
  ritual: 70,
  finale: 88,
  cool: 116,
  tripHop: 72,
  neoclassical: 66,
  minimalism: 108,
  jChanson: 92,
  hiNRG: 132,
}

export const STYLE_OPTIONS: { value: StyleId; label: string; tagline: string }[] = [
  { value: "ethereal", label: "Ethereal", tagline: "浮遊・透明・夢幻" },
  { value: "romanticDark", label: "Romantic Dark", tagline: "暗い官能とエレガンス" },
  { value: "cinematic", label: "Cinematic", tagline: "映画的・壮大・感情の起伏" },
  { value: "newWave", label: "New Wave", tagline: "80s/90s シンセポップの脈動" },
  { value: "symphonicRock", label: "Symphonic Rock", tagline: "劇的・ゴシック・重厚" },
  { value: "ritual", label: "Ritual", tagline: "儀式的・旋法的・催眠的" },
  { value: "finale", label: "Finale", tagline: "解放とカタルシス" },
  { value: "cool", label: "Cool", tagline: "クール・都会的・ランウェイ" },
  { value: "tripHop", label: "Trip-Hop", tagline: "ダブ・反復・低音の重み" },
  { value: "neoclassical", label: "Neoclassical", tagline: "ロマン派・劇的・ヨーロピアン" },
  { value: "minimalism", label: "Minimalism", tagline: "反復・オスティナート・静かな高揚" },
  { value: "jChanson", label: "J-Chanson", tagline: "和製シャンソン・エキゾティカ・ミステリアス" },
  { value: "hiNRG", label: "Hi-NRG", tagline: "疾走・ダーク・ディスコ" },
]

interface StylePrefs {
  /** 素の三和音に装飾を加える確率 */
  decorationProb: number
  /** スラッシュベースを試みる確率 */
  slashProb: number
  /** マイナー系コードに使う装飾 */
  minorColors: string[]
  /** メジャー系コードに使う装飾 */
  majorColors: string[]
}

export const STYLE_PREFS: Record<StyleId, StylePrefs> = {
  ethereal: {
    decorationProb: 0.75,
    slashProb: 0.3,
    minorColors: ["add9", "m9", "m11", "sus2"],
    majorColors: ["add9", "maj7", "sus2"],
  },
  romanticDark: {
    decorationProb: 0.6,
    slashProb: 0.2,
    minorColors: ["add9", "m9"],
    majorColors: ["maj7", "add9"],
  },
  cinematic: {
    decorationProb: 0.55,
    slashProb: 0.25,
    minorColors: ["add9", "m9"],
    majorColors: ["maj7", "add9"],
  },
  newWave: {
    decorationProb: 0.35,
    slashProb: 0.1,
    minorColors: ["add9"],
    majorColors: ["add9", "6"],
  },
  symphonicRock: {
    decorationProb: 0.35,
    slashProb: 0.15,
    minorColors: ["add9"],
    majorColors: ["maj7"],
  },
  ritual: {
    decorationProb: 0.45,
    slashProb: 0.1,
    minorColors: ["add9", "sus2"],
    majorColors: ["sus2", "add9"],
  },
  finale: {
    decorationProb: 0.5,
    slashProb: 0.2,
    minorColors: ["add9"],
    majorColors: ["maj7", "add9"],
  },
  cool: {
    decorationProb: 0.4,
    slashProb: 0.2,
    minorColors: ["7", "m9", "6"],
    majorColors: ["7", "6", "add9"],
  },
  tripHop: {
    decorationProb: 0.35,
    slashProb: 0.15,
    minorColors: ["7", "m9"],
    majorColors: ["7", "6"],
  },
  neoclassical: {
    decorationProb: 0.6,
    slashProb: 0.45,
    minorColors: ["add9", "m9", "maj7"],
    majorColors: ["maj7", "add9"],
  },
  minimalism: {
    decorationProb: 0.15,
    slashProb: 0.15,
    minorColors: ["sus2"],
    majorColors: ["6"],
  },
  jChanson: {
    decorationProb: 0.55,
    slashProb: 0.25,
    minorColors: ["maj7", "m9"],
    majorColors: ["maj7", "add9", "6"],
  },
  hiNRG: {
    decorationProb: 0.3,
    slashProb: 0.1,
    minorColors: ["7"],
    majorColors: ["6", "add9"],
  },
}

interface MoodProfile {
  /** テンプレートにこの文字列が含まれると選ばれやすくなる */
  affinity: string[]
  /** 装飾で優先するサフィックス */
  colors: string[]
}

export const MOOD_PROFILES: Record<MoodId, MoodProfile> = {
  melancholic: { affinity: ["add9", "maj7", "ivm9"], colors: ["add9", "m9", "maj7"] },
  mysterious: { affinity: ["bII", "sus2", "i11"], colors: ["sus2", "m11"] },
  romantic: { affinity: ["maj7", "ivm9", "V7sus4"], colors: ["maj7", "m9"] },
  dark: { affinity: ["dim", "bII", "V7", "bVI"], colors: ["add9"] },
  hopeful: { affinity: ["bIII", "bVImaj7", "IV"], colors: ["maj7", "add9", "6"] },
  dramatic: { affinity: ["V", "bVI", "bVII"], colors: ["7sus4", "add9"] },
  floating: { affinity: ["add9", "sus", "maj7"], colors: ["add9", "sus2", "m11"] },
  tense: { affinity: ["V7", "dim", "bII", "sus4"], colors: ["sus4", "7sus4"] },
  dance: { affinity: ["bVII", "i7", "iv7", "vi7"], colors: ["7", "6", "m9"] },
}
