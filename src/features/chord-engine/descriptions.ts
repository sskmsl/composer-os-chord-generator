import type { MoodId, SectionId, StyleId } from "@/types/music"
import type { Features } from "./scoring"
import { pick } from "./random"

const STYLE_OPENERS: Record<StyleId, string[]> = {
  ethereal: ["霧の中を漂うような浮遊感のある進行。", "輪郭の溶けた透明な響き。", "重力から解き放たれたような進行。"],
  romanticDark: ["夜の官能をまとった暗いロマンスの進行。", "優雅さと影が同居する進行。", "ビロードのような暗い甘さを持つ進行。"],
  cinematic: ["スクリーンが広がるような映画的な進行。", "情景が立ち上がるドラマティックな進行。", "カメラが引いていくような壮大さを持つ進行。"],
  newWave: ["シンセの脈動が似合う80s的な進行。", "機械的でありながら感情的な進行。", "ドライブ感のあるニューウェイヴ進行。"],
  symphonicRock: ["オーケストラとバンドが交差する重厚な進行。", "ゴシックな力強さを持つ進行。", "劇場の幕が上がるような進行。"],
  ritual: ["儀式のように反復する旋法的な進行。", "古代的な神秘をまとう進行。", "催眠的なドローンの上を漂う進行。"],
  finale: ["最後のサビへ向かう解放の進行。", "暗闇の後の光のようなカタルシスを持つ進行。", "エンドロールにふさわしい進行。"],
}

const MOOD_PHRASES: Record<MoodId, string> = {
  melancholic: "静かな喪失感",
  mysterious: "謎めいた気配",
  romantic: "ロマンティックな熱",
  dark: "深い闇の質感",
  hopeful: "微かな希望の光",
  dramatic: "劇的な感情の起伏",
  floating: "浮遊する無重力感",
  tense: "張り詰めた緊張",
}

const SECTION_CLOSERS: Record<SectionId, string[]> = {
  intro: ["曲の扉を静かに開きます。", "これから始まる物語を予感させます。"],
  verse: ["言葉を語るための余白を残します。", "抑制された足取りで物語を進めます。"],
  preChorus: ["サビへの期待を一気に高めます。", "感情が満ちていく助走になります。"],
  chorus: ["感情の解放点として機能します。", "記憶に残るサビの土台になります。"],
  bridge: ["物語を予期しない場所へ運びます。", "視界が反転するような転換を生みます。"],
  outro: ["余韻を残したまま景色をフェードさせます。", "終わりきらない残響を漂わせます。"],
}

export function buildDescription(
  style: StyleId,
  mood: MoodId,
  section: SectionId,
  f: Features,
): string {
  const featurePhrases: string[] = []
  if (f.descendingBass) featurePhrases.push("下降するベースライン")
  if (f.ascendingBass) featurePhrases.push("上昇していくベースの推進力")
  if (f.pedalBass) featurePhrases.push("持続するペダルベース")
  if (f.hasBviBviiTonic) featurePhrases.push("bVI→bVII→i の映画的な上昇")
  if (f.hasBII) featurePhrases.push("bII の翳り")
  if (f.hasDim) featurePhrases.push("ディミニッシュの不穏な影")
  if (f.hasSlash) featurePhrases.push("スラッシュベースの滑らかな声部連結")
  if (f.softColorCount >= 2) featurePhrases.push("add9/maj7 の柔らかな色彩")
  if (f.endsUnresolved) featurePhrases.push("解決しない終止")
  else if (f.dominantPrep) featurePhrases.push("ドミナントからの確かな解決")

  const middle =
    featurePhrases.length > 0
      ? `${pick(featurePhrases)}が${MOOD_PHRASES[mood]}を描き、`
      : `${MOOD_PHRASES[mood]}をたたえながら、`

  return `${pick(STYLE_OPENERS[style])}${middle}${pick(SECTION_CLOSERS[section])}`
}
