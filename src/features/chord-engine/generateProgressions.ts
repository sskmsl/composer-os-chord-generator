import type { MoodId, MusicKey, RuleSection, SectionId, StyleId } from "@/types/music"
import { keyLabel, PERIOD_CHORD_COUNT, sectionRule } from "@/types/music"
import { alignBeatsToBars, type GeneratedProgression } from "@/types/progression"
import type { ParsedChord } from "./degrees"
import { bassNoteName, buildToken, chordName, parseToken, tokenFromChordSymbol } from "./degrees"
import { decorateProgression } from "./decorate"
import { buildDescription } from "./descriptions"
import { chance, pick } from "./random"
import { computeScores, extractFeatures, type CadenceType } from "./scoring"
import {
  cadentialTokens,
  commonToneSubstitutes,
  matchesStyleSignature,
  openColors,
  rootKey,
  spiceTokens,
  styleVocabulary,
  tensionTokens,
  tonicTokens,
} from "./styleGrammar"
import { continuationsOf, generateChain } from "./transitions"
import { featureTags, preferenceBonus, type PreferenceModel } from "@/features/preference/preferenceModel"
import { applyVoiceLeadingBass } from "./voiceLeading"

export interface GenerateParams {
  key: MusicKey
  style: StyleId
  section: SectionId
  mood: MoodId
  count: number
  /** 進行のコード数(2〜5)。省略時は3〜5でランダムに揺らぐ */
  length?: number
  /**
   * 曲集(保存済みの進行)で既に使った骨格。同じ style×調 の保存済み進行から集めて渡すと、
   * 同じ骨格の候補を減点し、数百曲作っても同じ進行の型に偏らないようにする。
   */
  usedSkeletons?: ReadonlySet<string>
  /** 保存の傾向から学んだ好み。渡すと、好みに近い候補を順位で少し優遇する(表示する点数は変えない) */
  preference?: PreferenceModel | null
}

/**
 * メインエントリポイント。
 * テンプレート選択 → セクション変形 → 装飾 → 移調 → スコア/説明文 の
 * パイプラインで重複しない候補プールを作り、Boutonnat的な審美眼(boutonnat
 * スコア)を最終フィルタとして上位 count 件だけを返す。
 * 「安全だが平凡」な候補だけが並ばないよう、候補評価を出力選定に直結させる。
 * さらに、同じ style×調 を繰り返し使ったときにルート進行の「骨格」
 * (色彩・スラッシュを無視した度数の並び)が何度も出てこないよう、
 * セッション内の直近履歴で軽く減点する(§骨格反復の抑制)。
 */
export function generateProgressions(params: GenerateParams): GeneratedProgression[] {
  const poolTarget = Math.min(params.count * 3, 60)
  const maxAttempts = poolTarget * 10
  const pool: GeneratedProgression[] = []
  const seen = new Set<string>()

  for (let attempt = 0; attempt < maxAttempts && pool.length < poolTarget; attempt++) {
    const progression = generateOne(params)
    const dedupKey = progression.chords.join("|")
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    // そのスタイルの性格(シグネチャー)を欠いた候補は、点数に関わらず出さない。
    // 8小節フレーズは前半・後半それぞれが4コードの進行としてスタイルを満たすこと
    const parsedChords = progression.romanNumerals.map(parseToken)
    const halves = params.length === PERIOD_CHORD_COUNT ? [parsedChords.slice(0, 4), parsedChords.slice(4)] : [parsedChords]
    if (!halves.every((half) => matchesStyleSignature(params.style, half, params.key.mode))) continue
    pool.push(progression)
  }

  const selected = rankAndSelect(pool, params.style, params.key.mode, params.count, params.usedSkeletons, params.preference)
  if (!REPETITIVE_STYLES.has(params.style)) {
    const bucket = skeletonBucket(params.style, params.key.mode)
    for (const p of selected) recordSkeleton(bucket, rootSkeletonOf(p.romanNumerals))
  }
  return selected
}

/**
 * 骨格反復の抑制はstyle×調(=Markovの語彙プールと同じ単位)ごとに履歴を持つ。
 * この履歴はブラウザセッション中(タブを開いている間)だけ効く。セッションをまたいだ
 * 曲集全体の重複は、呼び出し側が渡す usedSkeletons(保存済み進行の骨格)で抑える。
 */
const SKELETON_HISTORY_LIMIT = 40
const skeletonHistory = new Map<string, string[]>()

function skeletonBucket(style: StyleId, mode: MusicKey["mode"]): string {
  return `${style}-${mode}`
}

/** 色彩(サフィックス)・スラッシュベースを無視した、度数だけのルート進行 */
export function rootSkeletonOf(romanNumerals: string[]): string {
  return romanNumerals
    .map((token) => {
      const p = parseToken(token)
      const accStr = p.acc === -1 ? "b" : p.acc === 1 ? "#" : ""
      return accStr + (p.lower ? p.roman.toLowerCase() : p.roman)
    })
    .join("-")
}

/** セッション内の骨格履歴を消す(テストと、別セッションを模した計測用) */
export function clearSessionSkeletonHistory(): void {
  skeletonHistory.clear()
}

function recordSkeleton(bucket: string, skeleton: string): void {
  const list = skeletonHistory.get(bucket) ?? []
  list.push(skeleton)
  if (list.length > SKELETON_HISTORY_LIMIT) list.shift()
  skeletonHistory.set(bucket, list)
}

function wasRecentlyUsed(bucket: string, skeleton: string): boolean {
  return skeletonHistory.get(bucket)?.includes(skeleton) ?? false
}

/**
 * Minimalism/Trip-Hop/Ritual/Electronica/Slowcoreは同じ骨格を反復すること自体が持ち味のスタイルなので、
 * 和声のリズム変化(§computeHarmonicRhythm)と骨格反復の抑制のどちらも対象外とする。
 */
const REPETITIVE_STYLES = new Set<StyleId>(["minimalism", "tripHop", "ritual", "electronica", "slowcore"])

function rankAndSelect(
  pool: GeneratedProgression[],
  style: StyleId,
  mode: MusicKey["mode"],
  count: number,
  usedSkeletons?: ReadonlySet<string>,
  preference?: PreferenceModel | null,
): GeneratedProgression[] {
  // スコアは決定的な整数なので同点が多い。1未満の乱数を足して同点内の順序だけを
  // 揺らし、同じ条件で何度生成しても同じ顔ぶれに偏らないようにする
  // (異なる点数の大小関係は崩さない)。
  // 減点: このセッションで直近に出した骨格は3点、曲集(保存済み)で使った骨格は2点
  const bucket = skeletonBucket(style, mode)
  const penalty = (p: GeneratedProgression) => {
    if (REPETITIVE_STYLES.has(style)) return 0
    const skeleton = rootSkeletonOf(p.romanNumerals)
    if (wasRecentlyUsed(bucket, skeleton)) return 3
    return usedSkeletons?.has(skeleton) ? 2 : 0
  }
  const ranked = pool.map((p) => {
    const personalFit = preferenceBonus(preference, p.featureTags ?? [])
    return { p: preference ? { ...p, personalFit } : p, rank: p.scores.boutonnat - penalty(p) + personalFit + Math.random() * 0.99 }
  })
  return ranked
    .sort((a, b) => b.rank - a.rank)
    .slice(0, count)
    .map(({ p }) => p)
}

function generateOne(params: GenerateParams): GeneratedProgression {
  const { key, style, section, mood, length } = params

  const isPeriod = length === PERIOD_CHORD_COUNT
  let tokens = isPeriod
    ? buildPeriod(style, key.mode, mood, section)
    : adaptToSection(generateChain(style, key.mode, mood, length), section, key, style)
  // 8小節フレーズは「同じ出だし」自体が構造なので、代理和音で崩さない
  if (!isPeriod && chance(SUBSTITUTION_PROBABILITY)) tokens = substituteOneChord(tokens, style, key.mode)
  const decorated = decorateProgression(tokens.map(parseToken), style, mood, key.mode)
  const { chords: parsed, invertedIndices } = applyVoiceLeadingBass(decorated, style)

  const chords = parsed.map((c) => chordName(c, key))
  const romanNumerals = parsed.map((c) => c.token)
  const features = extractFeatures(parsed, key.mode)

  return {
    id: crypto.randomUUID(),
    chords,
    key: keyLabel(key),
    mode: key.mode,
    style,
    section,
    mood,
    romanNumerals,
    bassMovement: describeBassMovement(parsed, key),
    description: (isPeriod ? PERIOD_DESCRIPTION : "") + buildDescription(style, mood, section, features),
    scores: computeScores(features),
    featureTags: featureTags(features),
    // 8小節フレーズは4小節+4小節の形そのものが構造なので、1和音=1小節に揃える
    beats: isPeriod ? parsed.map(() => 4) : computeHarmonicRhythm(parsed.length, style, invertedIndices, features.cadence),
    createdAt: new Date().toISOString(),
  }
}

/**
 * 手で書き換えたコード名から、度数表記・ベースの動き・説明文・スコアを計算し直す。
 * コードだけ差し替えて他が元の進行のまま残ると、詳細画面の度数や点数が実際の響きと食い違うため。
 * 解釈できないコードが1つでもあれば null。
 */
export function reanalyzeChords(
  chords: string[],
  params: { key: MusicKey; style: StyleId; mood: MoodId; section: SectionId },
): Pick<GeneratedProgression, "romanNumerals" | "bassMovement" | "description" | "scores" | "featureTags"> | null {
  const tokens = chords.map((chord) => tokenFromChordSymbol(chord, params.key))
  if (tokens.some((token) => token === null)) return null
  const parsed = (tokens as string[]).map(parseToken)
  const features = extractFeatures(parsed, params.key.mode)
  return {
    romanNumerals: parsed.map((c) => c.token),
    // ベースの音名は入力したコードの綴りのまま(Db を C# と書き換えない)
    bassMovement: describeBassMovement(
      parsed,
      params.key,
      chords.map((chord) => chord.split("/")[1]?.trim() || /^[A-G][#b]?/.exec(chord.trim())![0]),
    ),
    description: buildDescription(params.style, params.mood, params.section, features),
    scores: computeScores(features),
    featureTags: featureTags(features),
  }
}

/**
 * 保存した進行を別の調へ移す。度数(romanNumerals)はそのままに、コード名とベースの動きだけを
 * 新しい調で作り直す(度数・スコア・説明文は調に依存しないので変わらない)。
 */
export function transposeProgression(
  romanNumerals: string[],
  key: MusicKey,
): Pick<GeneratedProgression, "key" | "chords" | "bassMovement"> {
  const parsed = romanNumerals.map(parseToken)
  return {
    key: keyLabel(key),
    chords: parsed.map((c) => chordName(c, key)),
    bassMovement: describeBassMovement(parsed, key),
  }
}

const PERIOD_DESCRIPTION = "前半4小節で問いかけ、同じ出だしの後半4小節で答える8小節フレーズ。"

/** 次のセクションへつなぐため、8小節フレーズでも最後を解決させないセクション */
const OPEN_ENDED_SECTIONS: RuleSection[] = ["intro", "preChorus", "breakdownChorus", "cMelody"]

/** 指定した和音と根音が同じ候補を避けて選ぶ(候補がそれしか無ければそのまま選ぶ) */
function pickAvoiding(candidates: string[], ...avoid: string[]): string {
  const avoidRoots = new Set(avoid.map(rootKey))
  const usable = candidates.filter((t) => !avoidRoots.has(rootKey(t)))
  return pick(usable.length > 0 ? usable : candidates)
}

/**
 * 8小節フレーズ(楽式でいう「楽節」)。前半4小節は次へ向かう和音で止めて「問い」とし、
 * 後半4小節は同じ出だし2和音で始めて、最後にトニックへ着地して「答え」る。
 * 次のセクションへつなぐ場面(Bメロ・Cメロ等)では、後半も前半と別の緊張の和音で止める。
 * 和音はすべてそのスタイルのテンプレートと遷移表から選ぶ。
 */
function buildPeriod(style: StyleId, mode: MusicKey["mode"], mood: MoodId, section: SectionId): string[] {
  const antecedent = generateChain(style, mode, mood, 4).slice(0, 4)
  while (antecedent.length < 4) antecedent.push(pick(tensionTokens(style, mode)))
  // 後半は前半の出だしで始まるので、出だし2和音が同じ根音なら、前半の終わりもそれと変えて3連続を防ぐ
  const openingRepeats = rootKey(antecedent[0]) === rootKey(antecedent[1])
  antecedent[3] = pickAvoiding(
    tensionTokens(style, mode),
    antecedent[2],
    ...(openingRepeats ? [antecedent[0]] : []),
  )

  const tonicRoot = mode === "minor" ? "i" : "I"
  const openEnded = OPEN_ENDED_SECTIONS.includes(sectionRule(section))
  // 答えの3つ目: 着地するなら、そのスタイルでトニックの直前に置かれる和音(終止の準備)。
  // 止めるなら、出だしからの自然な流れ(遷移表の続き)
  const flow = continuationsOf(style, mode, antecedent[1]).filter((t) => rootKey(t) !== tonicRoot)
  const approach = openEnded ? flow : cadentialTokens(style, mode)
  const third = approach.length > 0 ? pickAvoiding(approach, antecedent[1]) : pickAvoiding(tensionTokens(style, mode), antecedent[1])
  const endings = openEnded
    ? tensionTokens(style, mode).filter((t) => rootKey(t) !== rootKey(antecedent[3]))
    : tonicTokens(style, mode)
  const last = pickAvoiding(endings.length > 0 ? endings : tensionTokens(style, mode), third)
  return [...antecedent, antecedent[0], antecedent[1], third, last]
}

/** 生成した進行の1か所を代理和音へ差し替える確率 */
const SUBSTITUTION_PROBABILITY = 0.35

/**
 * 進行の中ほど(先頭と末尾以外)の和音を1つ、同じスタイルの代理和音(共通音2つ以上)へ
 * 差し替える。テンプレートの組み合わせだけでは骨格の種類に限りがあるため、流れと
 * スタイルを保ったまま骨格の幅を広げる。前後と同じ根音になる候補は選ばない。
 */
function substituteOneChord(tokens: string[], style: StyleId, mode: MusicKey["mode"]): string[] {
  if (tokens.length < 3) return tokens
  const index = 1 + Math.floor(Math.random() * (tokens.length - 2))
  const neighbours = new Set([rootKey(tokens[index - 1]), rootKey(tokens[index + 1])])
  const candidates = commonToneSubstitutes(style, mode, tokens[index]).filter((t) => !neighbours.has(rootKey(t)))
  if (candidates.length === 0) return tokens
  const result = [...tokens]
  result[index] = pick(candidates)
  return result
}

/**
 * 常に4拍固定だった和声のリズムに緩急を作る。声部進行で転回した経過的な
 * コードは短く軽く通過させ、機能和声的にしっかり着地する終止は長く持たせて
 * 「一度和声を引いてから解放する」呼吸を生む。REPETITIVE_STYLESは
 * 均等な反復そのものが持ち味のスタイルなので対象外とする。
 */
function computeHarmonicRhythm(
  length: number,
  style: StyleId,
  invertedIndices: Set<number>,
  cadence: CadenceType,
): number[] {
  const beats = Array.from({ length }, () => 4)
  if (REPETITIVE_STYLES.has(style)) return beats

  for (const i of invertedIndices) {
    if (chance(0.7)) beats[i] = 2
  }

  const lastIdx = length - 1
  if (lastIdx > 0 && (cadence === "authentic" || cadence === "plagal") && chance(0.6)) {
    beats[lastIdx] = 8
  }

  return alignBeatsToBars(beats)
}

/** CHORD_ENGINE_SPEC §6 のセクションルールでテンプレートを変形する */
function adaptToSection(tokens: string[], section: SectionId, key: MusicKey, style: StyleId): string[] {
  const mode = key.mode
  let result = [...tokens]
  const rule: RuleSection = sectionRule(section)
  const last = () => result.length - 1
  // 変形で差し込む和音は、すべてそのスタイルのテンプレートから選ぶ(styleGrammar.ts)
  const hasSpice = () => {
    const spiceRoots = new Set(spiceTokens(style, mode).map(rootKey))
    return result.some((t) => spiceRoots.has(rootKey(t)))
  }
  // 末尾を差し替える。直前2つと同じ和音にして3連続(停滞)になる候補は除き、
  // 候補が残らなければ差し替えない
  const replaceLast = (candidates: string[]) => {
    const n = result.length
    const avoid = n >= 3 && rootKey(result[n - 2]) === rootKey(result[n - 3]) ? rootKey(result[n - 2]) : null
    const usable = candidates.filter((t) => rootKey(t) !== avoid)
    if (usable.length > 0) result[n - 1] = pick(usable)
  }

  switch (rule) {
    case "intro":
      // 疎に: 2〜4コード、終止は未解決に
      if (chance(0.5)) result = result.slice(0, 2)
      result[last()] = unresolveToken(result[last()], style, mode)
      break

    case "verse":
      // 抑制: 強い解決(V7)を弱める
      if (/V7(?!sus)/.test(result[last()]) && chance(0.5)) {
        result[last()] = unresolveToken(result[last()], style, mode)
      }
      break

    case "preChorus":
      // 末尾を、そのスタイルが実際に使う「トニック以外の終わり方」にして緊張を作る
      replaceLast(tensionTokens(style, mode))
      break

    case "chorus":
      break

    case "breakdownChorus":
      // 落ちサビ: サビの和声感を保ちながら密度と終止感を抑える
      if (result.length > 3) result = result.slice(0, 3)
      if (chance(0.65)) {
        result[last()] = unresolveToken(result[last()], style, mode)
      }
      break

    case "grandChorus": {
      // 最後のサビ: 半分の確率でトニック終止を保証して解放感を出す
      const tonics = tonicTokens(style, mode)
      if (mode === "minor" && tonics.length > 0 && chance(0.5) && rootKey(result[last()]) !== "i") {
        replaceLast(tonics)
      }
      break
    }

    case "cMelody":
      // Cメロ: そのスタイルにとっての色彩和音で新しい景色を作り、後続サビへの緊張を残す
      if (!hasSpice()) result[Math.min(1, last())] = pick(spiceTokens(style, mode))
      if (chance(0.55)) replaceLast(tensionTokens(style, mode))
      break

    case "bridge":
      // そのスタイルの色彩和音・意外な和音を注入する
      if (result.length >= 2 && !hasSpice() && chance(0.35)) {
        result[1] = pick(spiceTokens(style, mode))
      }
      break

    case "instrumental":
      // 間奏: 歌唱終止を要求せず、色彩和音と循環性を優先する
      if (result.length >= 2 && chance(0.5)) {
        replaceLast([result[0]])
      }
      break

    case "outro":
      // 反復とフェード
      if (result.length >= 2 && chance(0.6)) {
        result = [result[0], result[1], result[0], pick([result[0], result[1]])]
      }
      if (chance(0.5)) {
        result[last()] = unresolveToken(result[last()], style, mode)
      }
      break
  }
  return result
}

/**
 * 終止をぼかす。V はそのスタイルが持つsus形へ、素の和音はそのスタイルの
 * 装飾(Ritualならsus2、New Waveなら6th等)へ。スタイルに該当する装飾が
 * なければ手を付けない(スタイル外の響きを足さない)。
 */
function unresolveToken(token: string, style: StyleId, mode: MusicKey["mode"]): string {
  const parsed = parseToken(token)
  const allowed = styleVocabulary(style, mode).suffixes
  if (!parsed.lower && parsed.roman === "V" && parsed.acc === 0) {
    if (parsed.suffix.includes("sus")) return token
    const options = parsed.suffix === "7" ? ["7sus4", "sus4"] : ["sus4", "7sus4"]
    const next = options.find((s) => allowed.has(s))
    if (!next) return token
    parsed.suffix = next
  } else if (parsed.suffix === "") {
    const colors = openColors(style, parsed.lower)
    if (colors.length === 0) return token
    parsed.suffix = pick(colors)
  }
  return buildToken(parsed)
}

/** ベースの動きを音名列+輪郭ラベルで表現する */
function describeBassMovement(parsed: ParsedChord[], key: MusicKey, spelledNames?: string[]): string {
  const names = spelledNames ?? parsed.map((c) => bassNoteName(c, key))

  let desc = 0
  let asc = 0
  let pedal = 0
  for (let i = 1; i < names.length; i++) {
    if (names[i] === names[i - 1]) {
      pedal++
      continue
    }
    // 最短経路で方向を推定
    const prev = noteIndex(names[i - 1])
    const cur = noteIndex(names[i])
    if ((prev - cur + 12) % 12 <= 5) desc++
    else asc++
  }

  const steps = names.length - 1
  let label: string
  if (pedal === steps) label = "ペダル"
  else if (desc >= steps - pedal && desc > 0 && asc === 0) label = "下降ライン"
  else if (asc >= steps - pedal && asc > 0 && desc === 0) label = "上昇ライン"
  else if (names[0] === names[names.length - 1]) label = "回帰型"
  else label = "起伏型"

  return `${names.join(" → ")}(${label})`
}

const NOTE_INDEX: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
}

function noteIndex(name: string): number {
  return NOTE_INDEX[name] ?? 0
}
