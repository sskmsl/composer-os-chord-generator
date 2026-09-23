import type { Folder } from "@/types/folder"
import { migrateSavedProgression, type SavedProgression } from "@/types/progression"

/**
 * 同期(Supabase)はfire-and-forgetでベストエフォート、かつログイン時の同期は
 * ローカルとリモートをマージせず置き換える方式のため、それとは独立した
 * ユーザー自身で確保できる保険として、全データをJSON1ファイルに書き出す。
 */
export const BACKUP_FORMAT = "composer-os-chord-generator/backup" as const
export const BACKUP_VERSION = 1 as const

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  folders: Folder[]
  progressions: SavedProgression[]
}

export function buildBackup(folders: Folder[], progressions: SavedProgression[]): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    folders,
    progressions,
  }
}

export function downloadBackup(folders: Folder[], progressions: SavedProgression[]): void {
  const backup = buildBackup(folders, progressions)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `chord-generator-backup-${backup.exportedAt.slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * バックアップJSON文字列を検証しつつ読み込む。フォルダ・進行それぞれの中身までは
 * 厳密に検証しないが、古いバージョンのバックアップでも migrateSavedProgression を
 * 通すことで安全に復元できるようにする。
 */
export function parseBackup(text: string): { folders: Folder[]; progressions: SavedProgression[] } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("JSONとして読み込めませんでした")
  }

  if (typeof data !== "object" || data === null) {
    throw new Error("バックアップファイルの形式が正しくありません")
  }
  const record = data as Record<string, unknown>
  if (
    record.format !== BACKUP_FORMAT ||
    !Array.isArray(record.folders) ||
    !Array.isArray(record.progressions)
  ) {
    throw new Error("バックアップファイルの形式が正しくありません")
  }

  return {
    folders: record.folders as Folder[],
    progressions: (record.progressions as SavedProgression[]).map(migrateSavedProgression),
  }
}
