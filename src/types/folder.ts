/** 曲ごとに進行をまとめるフォルダ(= 1曲) */
export interface Folder {
  id: string
  name: string
  createdAt: string
  /** 最終更新日時。同期のマージ(新しい方を残す)判定に使う */
  updatedAt: string
  /** 曲全体のテンポ(BPM)。未設定なら書き出し時に先頭セクションのスタイルから導出 */
  tempo?: number
  /** 曲全体についてのメモ(構成の意図、アレンジのアイデアなど) */
  memo?: string
}

export function createFolder(name: string): Folder {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
  }
}

/** updatedAtを持たない旧データ(スキーマ追加前の保存分)を移行する */
export function migrateFolder(raw: Folder): Folder {
  return {
    ...raw,
    updatedAt: raw.updatedAt ?? raw.createdAt,
  }
}
