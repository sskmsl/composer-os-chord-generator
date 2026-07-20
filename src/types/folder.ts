/** 曲ごとに進行をまとめるフォルダ(= 1曲) */
export interface Folder {
  id: string
  name: string
  createdAt: string
  /** 曲全体のテンポ(BPM)。未設定なら書き出し時に先頭セクションのスタイルから導出 */
  tempo?: number
  /** 曲全体についてのメモ(構成の意図、アレンジのアイデアなど) */
  memo?: string
}

export function createFolder(name: string): Folder {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  }
}
