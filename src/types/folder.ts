/** 曲ごとに進行をまとめるフォルダ */
export interface Folder {
  id: string
  name: string
  createdAt: string
}

export function createFolder(name: string): Folder {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  }
}
