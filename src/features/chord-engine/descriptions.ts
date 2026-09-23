import type { MoodId, RuleSection, SectionId, StyleId } from "@/types/music"
import { sectionRule } from "@/types/music"
import type { CadenceType, Features } from "./scoring"
import { pick } from "./random"

/** 終止の型ごとの一言解説(音楽理論用語+効果の説明) */
const CADENCE_LABELS: Record<CadenceType, string> = {
  authentic: "完全終止(V→I)でしっかり着地",
  half: "半終止(Vで止め)、続きへの期待を残す",
  deceptive: "偽終止(Vから意外な和音へ)、予想を外して耳を引く",
  plagal: "変終止(IV→I)で、教会的な穏やかな着地",
  modal: "機能和声に頼らない、旋法的・借用和音的な着地",
}

const STYLE_OPENERS: Record<StyleId, string[]> = {
  ethereal: ["霧の中を漂うような浮遊感のある進行。", "輪郭の溶けた透明な響き。", "重力から解き放たれたような進行。"],
  romanticDark: ["夜の官能をまとった暗いロマンスの進行。", "優雅さと影が同居する進行。", "ビロードのような暗い甘さを持つ進行。"],
  cinematic: ["スクリーンが広がるような映画的な進行。", "情景が立ち上がるドラマティックな進行。", "カメラが引いていくような壮大さを持つ進行。"],
  newWave: ["シンセの脈動が似合う80s的な進行。", "機械的でありながら感情的な進行。", "ドライブ感のあるニューウェイヴ進行。"],
  sadcorePop: ["黄金時代のハリウッド映画が持つ、色褪せた郷愁の進行。", "煌びやかさの奥に退廃を滲ませる、ノスタルジックな進行。", "美しく朽ちていくような、シネマティックな哀愁を纏う進行。"],
  ritual: ["儀式のように反復する旋法的な進行。", "古代的な神秘をまとう進行。", "催眠的なドローンの上を漂う進行。"],
  finale: ["最後のサビへ向かう解放の進行。", "暗闇の後の光のようなカタルシスを持つ進行。", "エンドロールにふさわしい進行。"],
  cool: ["ランウェイを歩くような洗練された進行。", "無駄を削ぎ落としたクールな質感の進行。", "都会の夜に似合うスタイリッシュな進行。"],
  tripHop: ["ダブの残響が漂う、重心の低い進行。", "同じフレーズを繰り返す催眠的な反復進行。", "霧の立ち込める都会の夜に似合う、湿った質感の進行。"],
  neoclassical: ["ショパンの夜想曲を思わせる、流れるようなピアノの進行。", "劇的に転がるアルペジオを伴う、ロマン派的な進行。", "涙腺を刺激する、クラシカルで壮麗な進行。"],
  minimalism: ["同じ動機を執拗に反復するミニマルな進行。", "静かな高揚感が積み重なっていくオスティナート進行。", "簡素な骨格の上で徐々に熱を帯びていく進行。"],
  jChanson: ["スパイ映画のワンシーンのような、怪しく洗練された進行。", "煙草の煙が漂うシャンソン酒場のような進行。", "異国情緒とミステリアスな影が交差する進行。"],
  hiNRG: ["疾走するシンセベースに乗った、ダークなダンスフロアの進行。", "鼓動のように駆け抜ける、ドラマティックなディスコ進行。", "闇の中で光る、80年代的な高揚感を持つ進行。"],
  dorian: ["荒野を渡る風のような、旋法的でノスタルジックな進行。", "短調なのにどこか開けた表情を持つ、ドリアン旋法の進行。", "乾いた郷愁を漂わせる、フォークロック的な進行。"],
  electronica: ["揺らぐシンセパッドがループする、7th系の浮遊感を持つ進行。", "機械的な反復の奥で、温かい和音がゆっくり明滅する進行。", "ドミナントに頼らず、2つの響きを行き来して時間を溶かす進行。"],
  slowcore: ["遅いテンポで同じ和音に沈み込んでいく、静かな進行。", "余白と残響に語らせる、飾らない三和音の進行。", "ゆっくり下っていくベースが、諦めに似た哀しみを運ぶ進行。"],
  frenchPop: ["パリのカフェに似合う、洒脱で軽やかな循環進行。", "セブンスの柔らかさに、ほのかな憂いを忍ばせた進行。", "ささやくような歌声が似合う、気怠く洗練された進行。"],
  kayokyoku: ["80年代の歌謡曲を思わせる、哀愁を帯びた美しい短調の進行。", "ドミナントへ向かう引力が、胸を締めつけるような郷愁を生む進行。", "夜の街と雨を思わせる、ノスタルジックなマイナー進行。"],
}

interface MoodPhrase {
  text: string
  /** この特徴を持つ進行でだけ使う表現。無ければ既定の表現 */
  when?: (f: Features) => boolean
}

const unresolved = (f: Features) => f.endsUnresolved
const softColors = (f: Features) => f.softColorCount >= 2

/**
 * ムードの表現。以前は1ムード1表現で、同じ条件で生成した5件がすべて「静かな喪失感」に
 * なっていた。既定の表現に加え、進行の特徴に結びついた表現を持たせ、合うものから選ぶ。
 */
const MOOD_PHRASES: Record<MoodId, MoodPhrase[]> = {
  melancholic: [
    { text: "静かな喪失感" },
    { text: "少しずつ沈んでいく哀しみ", when: (f) => f.descendingBass },
    { text: "言葉にならない未練", when: unresolved },
    { text: "柔らかく滲む切なさ", when: softColors },
  ],
  mysterious: [
    { text: "謎めいた気配" },
    { text: "得体の知れない揺らぎ", when: (f) => f.hasAug || f.hasDim },
    { text: "霧の奥で続く低い囁き", when: (f) => f.pedalBass },
    { text: "答えの出ない問い", when: unresolved },
  ],
  romantic: [
    { text: "ロマンティックな熱" },
    { text: "甘く溶けていく情感", when: softColors },
    { text: "焦がれるような引力", when: (f) => f.hasV7 },
    { text: "高まっていく想い", when: (f) => f.ascendingBass },
  ],
  dark: [
    { text: "深い闇の質感" },
    { text: "底知れない翳り", when: (f) => f.hasBII },
    { text: "不穏に軋む闇", when: (f) => f.hasDim },
    { text: "奈落へ降りていく重さ", when: (f) => f.descendingBass },
  ],
  hopeful: [
    { text: "微かな希望の光" },
    { text: "少しずつ開けていく視界", when: (f) => f.ascendingBass },
    { text: "確かな光への着地", when: (f) => !f.endsUnresolved },
    { text: "朝の光のような柔らかさ", when: softColors },
  ],
  dramatic: [
    { text: "劇的な感情の起伏" },
    { text: "大きく振れる感情の弧", when: (f) => f.largeArc },
    { text: "スクリーンいっぱいに広がる高揚", when: (f) => f.hasBviBviiTonic },
    { text: "引き絞られた緊張と解放", when: (f) => f.hasV7 },
  ],
  floating: [
    { text: "浮遊する無重力感" },
    { text: "地面から離れて漂う感覚", when: (f) => f.pedalBass },
    { text: "輪郭の溶けた浮遊感", when: softColors },
    { text: "着地しないままの漂い", when: unresolved },
  ],
  tense: [
    { text: "張り詰めた緊張" },
    { text: "軋むような緊迫", when: (f) => f.hasDim },
    { text: "神経を逆撫でする半音の緊張", when: (f) => f.chromaticInnerSteps > 0 },
    { text: "解けない緊張", when: unresolved },
  ],
  dance: [
    { text: "都会的な高揚感" },
    { text: "駆け上がる高揚", when: (f) => f.ascendingBass },
    { text: "脈打つ反復の昂り", when: (f) => f.pedalBass },
    { text: "前へ前へと押し出す推進力", when: (f) => f.hasV7 },
  ],
}

/** 特徴に合う表現があれば主にそれを使い、ときどき既定の表現も混ぜる */
function moodPhrase(mood: MoodId, f: Features): string {
  const phrases = MOOD_PHRASES[mood]
  const fitting = phrases.filter((p) => p.when?.(f))
  if (fitting.length === 0 || Math.random() < 0.3) return phrases[0].text
  return pick(fitting).text
}

const SECTION_CLOSERS: Record<RuleSection, string[]> = {
  intro: ["曲の扉を静かに開きます。", "これから始まる物語を予感させます。"],
  verse: ["言葉を語るための余白を残します。", "抑制された足取りで物語を進めます。"],
  preChorus: ["サビへの期待を一気に高めます。", "感情が満ちていく助走になります。"],
  chorus: ["感情の解放点として機能します。", "記憶に残るサビの土台になります。"],
  breakdownChorus: ["サビの輪郭を静けさの中に残します。", "抑えた響きで次の解放に余白を作ります。"],
  grandChorus: ["すべての感情を解き放つ最後のサビになります。", "物語の頂点でカタルシスをもたらします。"],
  cMelody: ["既存の景色から離れ、新しい旋律の物語を開きます。", "最後の展開へ向けて感情の視点を変えます。"],
  bridge: ["物語を予期しない場所へ運びます。", "視界が反転するような転換を生みます。"],
  instrumental: ["歌の余白で楽器の情景を広げます。", "旋律を休ませながら曲の景色をつなぎます。"],
  outro: ["余韻を残したまま景色をフェードさせます。", "終わりきらない残響を漂わせます。"],
}

/**
 * 検出された特徴を「際立ち度」順に並べる。終止の解決/未解決については
 * ここでは触れない(下の cadence の一文だけが担当する)。同じことを
 * 別の言い方で二重に言ったり、矛盾した内容が並んだりしないようにするため。
 */
function collectFeaturePhrases(f: Features): string[] {
  const phrases: string[] = []
  if (f.hasAug) phrases.push("オーギュメントの浮遊する違和感")
  if (f.hasBII) phrases.push("bII の翳り")
  if (f.hasDim) phrases.push("ディミニッシュの不穏な影")
  // 1箇所だけならこの語彙圏では珍しくないので、複数箇所で初めて「際立った特徴」として挙げる
  if (f.chromaticInnerSteps >= 2) phrases.push("内声がにじむように半音で動く気配")
  if (f.hasBviBviiTonic) phrases.push("bVI→bVII→i の映画的な上昇")
  if (f.hasSlash) phrases.push("スラッシュベースの滑らかな声部連結")
  if (f.pedalBass) phrases.push("持続するペダルベース")
  if (f.descendingBass) phrases.push("下降するベースライン")
  if (f.ascendingBass) phrases.push("上昇していくベースの推進力")
  if (f.chromaticInnerSteps === 0 && f.commonToneStrength >= 1.4) phrases.push("共通音でつながる滑らかな接続")
  if (f.softColorCount >= 2) phrases.push("add9/maj7 の柔らかな色彩")
  return phrases
}

export function buildDescription(
  style: StyleId,
  mood: MoodId,
  section: SectionId,
  f: Features,
): string {
  // ランダムに1つ拾うのではなく、際立った特徴を上から最大2つ具体的に挙げる
  const picked = collectFeaturePhrases(f).slice(0, 2)

  const moodText = moodPhrase(mood, f)
  const middle = picked.length > 0 ? `${picked.join("と")}が${moodText}を描き、` : `${moodText}をたたえながら、`

  return `${pick(STYLE_OPENERS[style])}${middle}${pick(SECTION_CLOSERS[sectionRule(section)])}終止は${CADENCE_LABELS[f.cadence]}。`
}
