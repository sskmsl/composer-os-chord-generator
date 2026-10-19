import { buildToken, isFlatKey, NOTE_TO_PC, parseToken } from "./degrees"
import { MAJOR_KEYS, MINOR_KEYS, type MusicKey, type StyleId } from "@/types/music"
import { relativeMajorDominant } from "./styleGrammar"
import type { SectionId } from "@/types/music"

/**
 * 曲構成の定番に基づく「次のセクション」の提案。
 * Generatorで現在のセクションを作り終えたユーザーに、次の一手を示す。
 */

/**
 * relative=関係調(平行調)へ、up=ラスサビ転調(全音上げ)へ、
 * down=同じモードのまま3半音下げ(短3度下。例: Eb → C、Am → F#m)へ、
 * parallel=同主短調(同じ主音の短調。C → Cm)への一時的な暗転、
 * home=曲の原調へ戻る
 */
export type KeyMoveType = "relative" | "up" | "down" | "parallel" | "home"

/** 3半音下げの移動量。参照ループ Ab–Bb–Eb–Cm → F–G–C–Am の間隔(いずれも3半音下) */
export const KEY_DOWN_SEMITONES = 3

export interface SectionSuggestion {
  section: SectionId
  reason: string
  /** 展開としてふさわしいKEY変更がある場合のみ指定。なければ現在のKEYを維持 */
  keyMove?: { type: KeyMoveType; reason: string }
  /** "relative": 次に相対長調のサビへ向かうセクションとして作る(プレコーラスの終わりを相対長調のV7にする) */
  approach?: "relative"
  /** 指定したモードの曲でだけ提案する(短調の曲から相対長調へ移す提案など) */
  onlyIn?: MusicKey["mode"]
}

/**
 * 今の調とスタイルで出してよい提案だけに絞る。
 * 相対長調のV7(短調のbVII7)で終わるBメロの提案(approach)は、そのスタイルがその終止を出せるときだけ。
 * 出せないスタイルでは、効果の無い提案を約束しないよう出さない。
 */
export function suggestionsFor(section: SectionId, key: MusicKey, style: StyleId): SectionSuggestion[] {
  return NEXT_SECTIONS[section].filter(
    (s) =>
      (s.onlyIn === undefined || s.onlyIn === key.mode) &&
      (s.approach !== "relative" || relativeMajorDominant(style, key.mode) !== null),
  )
}

export const NEXT_SECTIONS: Record<SectionId, SectionSuggestion[]> = {
  intro: [
    { section: "verse", reason: "定番。静かな導入からAメロで物語を語り始める" },
    { section: "chorus", reason: "サビ先行型。冒頭で一番強いフックを聴かせる" },
  ],
  verse: [
    { section: "pre-chorus", reason: "Bメロで緊張を高めてからサビへ" },
    {
      section: "pre-chorus",
      reason: "Bメロの終わりを相対長調のV7(短調のbVII7)にして、相対長調のサビへ入る準備をする",
      approach: "relative",
      onlyIn: "minor",
    },
    { section: "chorus", reason: "Bメロを挟まず直接サビへ(シンプルな構成)" },
    {
      section: "chorus",
      reason: "短調のAメロから、相対長調のサビで明るく開ける",
      keyMove: { type: "relative", reason: "相対長調へ転調する" },
      onlyIn: "minor",
    },
  ],
  "pre-chorus": [
    { section: "chorus", reason: "Bメロの高まりをサビで解放する(鉄板の流れ)" },
    {
      section: "chorus",
      reason: "短調のBメロから、相対長調のサビで明るく開ける",
      keyMove: { type: "relative", reason: "相対長調へ転調する" },
      onlyIn: "minor",
    },
  ],
  chorus: [
    { section: "verse", reason: "次のAメロへ。同じ景色を別の歌詞で描く" },
    {
      section: "breakdown-chorus",
      reason: "落ちサビで一度静けさへ引き、最後の解放を準備する",
      keyMove: { type: "parallel", reason: "同主短調へ一時的に暗転する(長調の曲のみ)" },
    },
    {
      section: "c-melody",
      reason: "Cメロで新しい旋律と和声の景色へ転換する",
      keyMove: { type: "relative", reason: "関係調に転調して景色を変える" },
    },
    {
      section: "bridge",
      reason: "ブリッジで同型のループを別の景色へ移す",
      keyMove: { type: "down", reason: "3半音下げて半音階的に景色を変える" },
    },
    { section: "outro", reason: "サビの余韻のまま締めくくる(短い曲向き)" },
  ],
  "breakdown-chorus": [
    {
      section: "grand-chorus",
      reason: "抑えた落ちサビから大サビへ解放する",
      keyMove: { type: "up", reason: "全音上げで最後の高まりを作る" },
    },
    {
      section: "chorus",
      reason: "通常のサビへ戻して解放する",
      keyMove: { type: "home", reason: "暗転から原調へ戻る" },
    },
  ],
  "grand-chorus": [
    {
      section: "outro",
      reason: "大サビの残響をアウトロへつなぐ",
      keyMove: { type: "home", reason: "原調に戻って終える" },
    },
  ],
  "c-melody": [
    {
      section: "grand-chorus",
      reason: "Cメロの転換から大サビへ向かう",
      keyMove: { type: "up", reason: "全音上げで最後の高まりを作る" },
    },
    {
      section: "chorus",
      reason: "新しい景色から通常のサビへ回帰する",
      keyMove: { type: "home", reason: "原調に戻る" },
    },
  ],
  bridge: [
    { section: "c-melody", reason: "ブリッジを経てCメロへ入り、物語を深める" },
    {
      section: "grand-chorus",
      reason: "転換からの最後のサビ(カタルシスの定番)",
      keyMove: { type: "up", reason: "ラスサビ転調(全音上げ)で最後の高まりを作る" },
    },
  ],
  instrumental: [
    { section: "verse", reason: "間奏からAメロへ戻り、歌の物語を再開する" },
    { section: "c-melody", reason: "間奏からCメロへ入り、新しい展開を作る" },
    { section: "grand-chorus", reason: "間奏から大サビへ直接つなぐ" },
  ],
  outro: [],
}

/** 調号が♯7つの調。同じ音の♭の調(Db・Bbm)の方が読みやすい */
const SEVEN_SHARP_KEYS = new Set(["C#-major", "A#-minor"])

/**
 * KeyMoveTypeから実際の推奨KEYを算出する。
 * - relative: マイナーなら関係長調(+3半音)、メジャーなら関係短調(-3半音)
 * - up: 同じモードのまま全音(+2半音)上げる
 * - down: 同じモードのまま3半音(短3度)下げる
 * - parallel: 長調なら同じ主音の短調(同主短調)へ。短調はそのまま
 * - home: 原調(originalKey)へ戻る。原調が分からなければ今の調のまま
 * 同主短調へ暗転している間の up は、暗転前の原調から全音上げる(暗転した短調から上げない)。
 * 実用キーリスト(MINOR_KEYS/MAJOR_KEYS)内から一致するものを探す。
 * 同じ音の調が2つある(D#m/Ebm 等)ときは、調号の少ない方(C#よりDb、A#mよりBbm)を選び、
 * 同じ数なら元の調と同じ♯・♭の綴りに揃える。
 */
export function resolveKeyMove(key: MusicKey, move: KeyMoveType, originalKey?: MusicKey): MusicKey {
  if (move === "home") return originalKey ?? key
  if (move === "parallel" && key.mode === "minor") return key
  // 同主短調へ暗転している間の up は、暗転前の原調を起点にする
  if (move === "up" && originalKey && NOTE_TO_PC[originalKey.tonic] === NOTE_TO_PC[key.tonic] && originalKey.mode !== key.mode) {
    return resolveKeyMove(originalKey, "up")
  }
  const tonicPc = NOTE_TO_PC[key.tonic]
  const targetMode = move === "relative" ? (key.mode === "minor" ? "major" : "minor") : move === "parallel" ? "minor" : key.mode
  const semitones = move === "relative" ? (key.mode === "minor" ? 3 : -3) : move === "down" ? -KEY_DOWN_SEMITONES : move === "parallel" ? 0 : 2
  const targetPc = (tonicPc + semitones + 12) % 12

  const candidates = targetMode === "minor" ? MINOR_KEYS : MAJOR_KEYS
  const rank = (k: MusicKey) =>
    (SEVEN_SHARP_KEYS.has(`${k.tonic}-${k.mode}`) ? 2 : 0) + (isFlatKey(k) === isFlatKey(key) ? 0 : 1)
  const matches = candidates.filter((k) => NOTE_TO_PC[k.tonic] === targetPc).sort((a, b) => rank(a) - rank(b))
  return matches[0] ?? key
}

/**
 * ループを度数のまま回して、別の和音から始める(offset=1 なら2つ目の和音が先頭)。
 * 度数(ローマ数字)は調に依存しないので、どの調でも回したあとの和音の並びは
 * 元のコード名を同じだけ回したものと一致する。次のセクションが前のループを
 * 開始位置を変えて使い回すときの土台(Ab–Bb–Eb–Cm → Eb–Cm–Ab–Bb 等)。
 * offset は負数や長さ以上も受け付け、長さで折り返す。
 */
export function rotateLoop<T>(loop: readonly T[], offset: number): T[] {
  if (loop.length === 0) return []
  const n = ((offset % loop.length) + loop.length) % loop.length
  return [...loop.slice(n), ...loop.slice(0, n)]
}

/**
 * 長調のループの度数を、同主短調の度数へ置き換える(同じ主音の短調での借用和音にする)。
 * I→i、IV→iv、ii→iiø、iii→bIII、vi→bVI、vii→bVII。V・bVII・bVI・bIII・bII などは
 * 長調でも短調でも同じ度数なのでそのまま。スラッシュベースは度数の意味が変わるので外す。
 */
export function toParallelMinor(loop: readonly string[]): string[] {
  return loop.map((token) => {
    const p = parseToken(token)
    if (p.acc !== 0) return token
    const keepSus = ["sus2", "sus4", "7sus4"].includes(p.suffix)
    const minorSuffix = keepSus ? p.suffix : p.suffix === "maj7" ? "m9" : ["aug", "dim", "ø", "m9"].includes(p.suffix) ? "" : p.suffix
    const majorSuffix = keepSus ? p.suffix : p.suffix === "7" ? "maj7" : ["aug", "dim", "ø", "m9"].includes(p.suffix) ? "" : p.suffix
    const built = (acc: number, roman: string, lower: boolean, suffix: string) => buildToken({ token: "", acc, roman, lower, suffix })
    switch (`${p.lower ? "l" : "u"}${p.roman}`) {
      case "uI":
        return built(0, "I", true, minorSuffix)
      case "uIV":
        return built(0, "IV", true, minorSuffix)
      case "lIV":
        return built(0, "IV", true, p.suffix)
      case "lII":
        return built(0, "II", true, "ø")
      case "lIII":
        return built(-1, "III", false, majorSuffix)
      case "lVI":
        return built(-1, "VI", false, majorSuffix)
      case "lVII":
        return built(-1, "VII", false, majorSuffix)
      default:
        return p.bass ? buildToken({ ...p, bass: undefined }) : token
    }
  })
}

/** 王道のフル構成(参考表示用) */
export const TYPICAL_SONG_FLOW: { section: SectionId; label: string }[] = [
  { section: "intro", label: "Intro" },
  { section: "verse", label: "A(1番)" },
  { section: "pre-chorus", label: "B" },
  { section: "chorus", label: "サビ" },
  { section: "verse", label: "A(2番)" },
  { section: "pre-chorus", label: "B" },
  { section: "chorus", label: "サビ" },
  { section: "instrumental", label: "間奏" },
  { section: "c-melody", label: "Cメロ" },
  { section: "breakdown-chorus", label: "落ちサビ" },
  { section: "grand-chorus", label: "大サビ" },
  { section: "outro", label: "Outro" },
]
