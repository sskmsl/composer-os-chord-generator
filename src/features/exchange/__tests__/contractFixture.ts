import type { Folder } from "@/types/folder"
import { PROGRESSION_SCHEMA_VERSION, type SavedProgression } from "@/types/progression"
import type { SectionId, StyleId } from "@/types/music"

/**
 * 交換形式(Composer Song Exchange)の契約見本を作るための、固定の入力。
 * contracts/composer-song-exchange.v2.example.json はこの入力を書き出した結果で、
 * Composer Arranger側にも同じファイルを置いて「読み込めること」をテストしている。
 * 書き出し処理を変えてテストが落ちたら、見本を更新して Arranger 側へも同じ内容を反映すること。
 *
 * 見本に含めている要素: 可変長のコード(2/4/8拍)、1小節を2コードで分け合う形、スラッシュコード、
 * ♭表記、繰り返し、セクションごとの転調(大サビで全音上げ)、新しいスタイルID、曲のメモ。
 */
export const CONTRACT_FOLDER: Folder = {
  id: "folder-contract",
  name: "Contract Song",
  createdAt: "2026-09-23T00:00:00.000Z",
  updatedAt: "2026-09-23T00:00:00.000Z",
  memo: "Aメロで静かに始め、大サビで全音上げる",
}

export const CONTRACT_EXPORTED_AT = "2026-09-23T00:00:00.000Z"

function section(
  order: number,
  section: SectionId,
  style: StyleId,
  key: string,
  chords: string[],
  beats: number[],
  repeatCount = 1,
): SavedProgression {
  return {
    id: `contract-${order}`,
    chords,
    key,
    mode: key.endsWith("m") ? "minor" : "major",
    style,
    section,
    mood: "melancholic",
    romanNumerals: chords.map(() => "i"),
    bassMovement: "",
    description: "",
    scores: { mylene: 6, boutonnat: 7, melancholy: 6, darkness: 4, cinematic: 5 },
    createdAt: "2026-09-23T00:00:00.000Z",
    beats,
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    memo: "",
    songIdea: "",
    arrangementNote: "",
    logicProNote: "",
    savedAt: "2026-09-23T00:00:00.000Z",
    folderId: CONTRACT_FOLDER.id,
    order,
    repeatCount,
  }
}

export const CONTRACT_PROGRESSIONS: SavedProgression[] = [
  section(1, "verse", "kayokyoku", "Am", ["Am", "E7/G#", "Am", "Dm6", "E7"], [2, 2, 4, 4, 4], 2),
  section(2, "chorus", "frenchPop", "Am", ["Fmaj7", "Bm7b5", "E7", "Am"], [4, 4, 4, 4]),
  section(3, "grand-chorus", "cinematic", "Bm", ["G", "A/C#", "Bm(add9)", "F#7sus4"], [4, 2, 2, 8]),
]
