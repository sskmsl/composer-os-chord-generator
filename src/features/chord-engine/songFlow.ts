import { NOTE_TO_PC } from "./degrees"
import { MAJOR_KEYS, MINOR_KEYS, type MusicKey } from "@/types/music"
import type { SectionId } from "@/types/music"

/**
 * 曲構成の定番に基づく「次のセクション」の提案。
 * Generatorで現在のセクションを作り終えたユーザーに、次の一手を示す。
 */

/** relative=関係調(平行調)へ、up=ラスサビ転調(全音上げ)へ */
export type KeyMoveType = "relative" | "up"

export interface SectionSuggestion {
  section: SectionId
  reason: string
  /** 展開としてふさわしいKEY変更がある場合のみ指定。なければ現在のKEYを維持 */
  keyMove?: { type: KeyMoveType; reason: string }
}

export const NEXT_SECTIONS: Record<SectionId, SectionSuggestion[]> = {
  intro: [
    { section: "verse1", reason: "定番。静かな導入からAメロで物語を語り始める" },
    { section: "chorus", reason: "サビ先行型。冒頭で一番強いフックを聴かせる" },
  ],
  verse: [
    { section: "preChorus", reason: "Bメロで緊張を高めてからサビへ" },
    { section: "chorus", reason: "Bメロを挟まず直接サビへ(シンプルな構成)" },
  ],
  verse1: [
    { section: "preChorus", reason: "Bメロで緊張を高めてからサビへ" },
    { section: "chorus", reason: "Bメロを挟まず直接サビへ(シンプルな構成)" },
  ],
  verse2: [
    { section: "preChorus", reason: "2番も同じ流れでBメロへ(1番と対にする)" },
    {
      section: "bridge",
      reason: "2番Aメロから間奏・Cメロで景色を変える",
      keyMove: { type: "relative", reason: "関係調に転調して景色を変える" },
    },
  ],
  verse3: [
    {
      section: "finalChorus",
      reason: "3番から最後のサビへ向かう終盤の定番",
      keyMove: { type: "up", reason: "ラスサビ転調(全音上げ)で最後の高まりを作る" },
    },
    { section: "outro", reason: "静かに締めくくりへ向かう" },
  ],
  preChorus: [
    { section: "chorus", reason: "Bメロの高まりをサビで解放する(鉄板の流れ)" },
  ],
  chorus: [
    { section: "verse2", reason: "2番Aメロへ。1番と同じ景色を別の歌詞で" },
    {
      section: "bridge",
      reason: "Cメロ・間奏で予期しない場所へ転換する",
      keyMove: { type: "relative", reason: "関係調に転調して景色を変える" },
    },
    { section: "outro", reason: "サビの余韻のまま締めくくる(短い曲向き)" },
  ],
  bridge: [
    {
      section: "finalChorus",
      reason: "転換からの最後のサビ(カタルシスの定番)",
      keyMove: { type: "up", reason: "ラスサビ転調(全音上げ)で最後の高まりを作る" },
    },
    { section: "chorus", reason: "通常のサビに戻る" },
  ],
  finalChorus: [
    { section: "outro", reason: "最後のサビの残響をアウトロで漂わせる" },
  ],
  outro: [],
}

/**
 * KeyMoveTypeから実際の推奨KEYを算出する。
 * - relative: マイナーなら関係長調(+3半音)、メジャーなら関係短調(-3半音)
 * - up: 同じモードのまま全音(+2半音)上げる
 * 実用キーリスト(MINOR_KEYS/MAJOR_KEYS)内から一致するものを探す。
 */
export function resolveKeyMove(key: MusicKey, move: KeyMoveType): MusicKey {
  const tonicPc = NOTE_TO_PC[key.tonic]
  const targetMode = move === "relative" ? (key.mode === "minor" ? "major" : "minor") : key.mode
  const semitones = move === "relative" ? (key.mode === "minor" ? 3 : -3) : 2
  const targetPc = (tonicPc + semitones + 12) % 12

  const candidates = targetMode === "minor" ? MINOR_KEYS : MAJOR_KEYS
  return candidates.find((k) => NOTE_TO_PC[k.tonic] === targetPc) ?? key
}

/** 王道のフル構成(参考表示用) */
export const TYPICAL_SONG_FLOW: { section: SectionId; label: string }[] = [
  { section: "intro", label: "Intro" },
  { section: "verse1", label: "A(1番)" },
  { section: "preChorus", label: "B" },
  { section: "chorus", label: "サビ" },
  { section: "verse2", label: "A(2番)" },
  { section: "preChorus", label: "B" },
  { section: "chorus", label: "サビ" },
  { section: "bridge", label: "C" },
  { section: "finalChorus", label: "落ちサビ/大サビ" },
  { section: "outro", label: "Outro" },
]
