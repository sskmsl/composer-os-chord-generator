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
    { section: "verse", reason: "定番。静かな導入からAメロで物語を語り始める" },
    { section: "chorus", reason: "サビ先行型。冒頭で一番強いフックを聴かせる" },
  ],
  verse: [
    { section: "pre-chorus", reason: "Bメロで緊張を高めてからサビへ" },
    { section: "chorus", reason: "Bメロを挟まず直接サビへ(シンプルな構成)" },
  ],
  "pre-chorus": [
    { section: "chorus", reason: "Bメロの高まりをサビで解放する(鉄板の流れ)" },
  ],
  chorus: [
    { section: "verse", reason: "次のAメロへ。同じ景色を別の歌詞で描く" },
    { section: "breakdown-chorus", reason: "落ちサビで一度静けさへ引き、最後の解放を準備する" },
    {
      section: "c-melody",
      reason: "Cメロで新しい旋律と和声の景色へ転換する",
      keyMove: { type: "relative", reason: "関係調に転調して景色を変える" },
    },
    { section: "outro", reason: "サビの余韻のまま締めくくる(短い曲向き)" },
  ],
  "breakdown-chorus": [
    {
      section: "grand-chorus",
      reason: "抑えた落ちサビから大サビへ解放する",
      keyMove: { type: "up", reason: "全音上げで最後の高まりを作る" },
    },
    { section: "chorus", reason: "通常のサビへ戻して解放する" },
  ],
  "grand-chorus": [
    { section: "outro", reason: "大サビの残響をアウトロへつなぐ" },
  ],
  "c-melody": [
    {
      section: "grand-chorus",
      reason: "Cメロの転換から大サビへ向かう",
      keyMove: { type: "up", reason: "全音上げで最後の高まりを作る" },
    },
    { section: "chorus", reason: "新しい景色から通常のサビへ回帰する" },
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
