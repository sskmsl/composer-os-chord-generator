import { useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { DatabaseBackup, FolderPlus, Pencil, Search, Sparkles, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FolderNameDialog } from "@/components/saved/FolderNameDialog"
import { SavedProgressionCard } from "@/components/saved/SavedProgressionCard"
import { SongPanel } from "@/components/song/SongPanel"
import { STYLE_OPTIONS } from "@/features/chord-engine/templates"
import { matchesQuery, SORT_OPTIONS, sortProgressions, type SortOrder } from "@/features/library/filterProgressions"
import { useAppStore } from "@/store/useAppStore"
import { cn } from "@/lib/utils"
import type { Folder } from "@/types/folder"

/** フォルダ絞り込み: all=すべて / none=未分類 / それ以外はフォルダid */
type FolderFilter = "all" | "none" | string

/** 一度に描画するカードの数。数百曲・数千進行でも一覧を軽く保つ */
const PAGE_SIZE = 30
/** フォルダバーに並べるフォルダの数(最近更新した順)。それ以外は「他のフォルダ」から選ぶ */
const CHIP_FOLDER_LIMIT = 8

const STYLE_FILTER_OPTIONS = [{ value: "all", label: "すべてのスタイル" }, ...STYLE_OPTIONS]

/** フォルダバーに出すフォルダ: 最近更新した順に上限まで。選択中のフォルダは必ず含める */
function chipFolders(folders: Folder[], active: FolderFilter): Folder[] {
  const recent = [...folders].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, CHIP_FOLDER_LIMIT)
  const activeFolder = folders.find((f) => f.id === active)
  return activeFolder && !recent.includes(activeFolder) ? [...recent, activeFolder] : recent
}

export function SavedProgressionsPage() {
  const navigate = useNavigate()
  const saved = useAppStore((s) => s.saved)
  const loaded = useAppStore((s) => s.loaded)
  const deleteSaved = useAppStore((s) => s.deleteSaved)
  const folders = useAppStore((s) => s.folders)
  const createFolder = useAppStore((s) => s.createFolder)
  const renameFolder = useAppStore((s) => s.renameFolder)
  const deleteFolder = useAppStore((s) => s.deleteFolder)
  const exportAllAsBackup = useAppStore((s) => s.exportAllAsBackup)
  const restoreFromBackup = useAppStore((s) => s.restoreFromBackup)

  const [searchParams, setSearchParams] = useSearchParams()
  // ダッシュボードの「最近の曲」から ?folder=<id> で直接その曲を開けるようにする
  const [filter, setFilterState] = useState<FolderFilter>(() => searchParams.get("folder") ?? "all")
  const [query, setQueryState] = useState("")
  const [styleFilter, setStyleFilterState] = useState("all")
  const [sortOrder, setSortOrderState] = useState<SortOrder>("newest")
  const [shownCount, setShownCount] = useState(PAGE_SIZE)
  // 絞り込み・並び替えを変えたら、表示件数を最初の1ページに戻す
  const resetPage = () => setShownCount(PAGE_SIZE)
  const setFilter = (f: FolderFilter) => {
    setFilterState(f)
    resetPage()
    setSearchParams(f === "all" ? {} : { folder: f }, { replace: true })
  }
  const setQuery = (q: string) => {
    setQueryState(q)
    resetPage()
  }
  const setStyleFilter = (v: string) => {
    setStyleFilterState(v)
    resetPage()
  }
  const setSortOrder = (v: SortOrder) => {
    setSortOrderState(v)
    resetPage()
  }
  const [pendingRestoreText, setPendingRestoreText] = useState<string | null>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  const folderNames = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders])

  const visible = useMemo(() => {
    const inFolder =
      filter === "all"
        ? saved
        : filter === "none"
          ? saved.filter((p) => p.folderId == null)
          : saved.filter((p) => p.folderId === filter)
    const filtered = inFolder.filter(
      (p) =>
        (styleFilter === "all" || p.style === styleFilter) &&
        matchesQuery(p, query, p.folderId ? folderNames.get(p.folderId) : undefined),
    )
    return sortProgressions(filtered, sortOrder)
  }, [saved, filter, styleFilter, query, sortOrder, folderNames])

  // フォルダごとの件数は1回の走査でまとめて数える(フォルダ数×進行数の繰り返しを避ける)
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of saved) map.set(p.folderId ?? "none", (map.get(p.folderId ?? "none") ?? 0) + 1)
    return map
  }, [saved])
  const countFor = (f: FolderFilter): number => (f === "all" ? saved.length : counts.get(f) ?? 0)

  const chips = chipFolders(folders, filter)
  const otherFolders = [...folders]
    .filter((f) => !chips.includes(f))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"))
  const filtersActive = query.trim() !== "" || styleFilter !== "all"

  const activeFolder = folders.find((f) => f.id === filter)

  const handleDelete = async (id: string, chords: string) => {
    try {
      await deleteSaved(id)
      toast.success(`「${chords}」を削除しました`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました")
    }
  }

  const handleBackup = () => {
    try {
      exportAllAsBackup()
      toast.success("全データをバックアップしました")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "バックアップに失敗しました")
    }
  }

  const handleRestoreFileSelected = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPendingRestoreText(String(reader.result))
    reader.onerror = () => toast.error("ファイルの読み込みに失敗しました")
    reader.readAsText(file)
  }

  const handleConfirmRestore = async () => {
    if (!pendingRestoreText) return
    try {
      await restoreFromBackup(pendingRestoreText)
      toast.success("バックアップから復元しました")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "復元に失敗しました")
    } finally {
      setPendingRestoreText(null)
      if (restoreInputRef.current) restoreInputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">Library</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-wide">Saved Progressions</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleBackup}>
            <DatabaseBackup data-icon="inline-start" />
            バックアップ
          </Button>
          <Button variant="outline" onClick={() => restoreInputRef.current?.click()}>
            <Upload data-icon="inline-start" />
            復元
          </Button>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => handleRestoreFileSelected(e.target.files?.[0])}
          />
          <Button onClick={() => navigate("/generator")}>
            <Sparkles data-icon="inline-start" />
            新しく生成する
          </Button>
        </div>
      </div>

      <AlertDialog open={pendingRestoreText != null} onOpenChange={(open) => !open && setPendingRestoreText(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>バックアップから復元しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              現在保存されているフォルダ・進行はすべて、このバックアップファイルの内容で置き換えられます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogCancel variant="destructive" onClick={() => void handleConfirmRestore()}>
              復元する
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* フォルダバー */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          すべて
          <Badge variant="secondary" className="ml-1.5 font-normal">{countFor("all")}</Badge>
        </FilterChip>
        <FilterChip active={filter === "none"} onClick={() => setFilter("none")}>
          未分類
          <Badge variant="secondary" className="ml-1.5 font-normal">{countFor("none")}</Badge>
        </FilterChip>
        {chips.map((f) => (
          <FilterChip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.name}
            <Badge variant="secondary" className="ml-1.5 font-normal">{countFor(f.id)}</Badge>
          </FilterChip>
        ))}
        {otherFolders.length > 0 && (
          <Select
            items={otherFolders.map((f) => ({ value: f.id, label: `${f.name} (${countFor(f.id)})` }))}
            value={null}
            onValueChange={(v) => v && setFilter(v as string)}
          >
            <SelectTrigger size="sm" aria-label="他のフォルダを選ぶ" className="rounded-full">
              <SelectValue placeholder={`他のフォルダ(${otherFolders.length})`} />
            </SelectTrigger>
            <SelectContent>
              {otherFolders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} ({countFor(f.id)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <FolderNameDialog
          title="新しいフォルダ(曲)"
          description="曲ごとに進行をまとめるフォルダを作成します。"
          submitLabel="作成する"
          onSubmit={async (name) => {
            const folder = await createFolder(name)
            setFilter(folder.id)
            toast.success(`フォルダ「${folder.name}」を作成しました`)
          }}
          trigger={
            <Button variant="outline" size="sm">
              <FolderPlus data-icon="inline-start" />
              新規フォルダ
            </Button>
          }
        />
        {activeFolder && (
          <div className="ml-auto flex items-center gap-1">
            <FolderNameDialog
              title="フォルダ名を変更"
              initialName={activeFolder.name}
              submitLabel="変更する"
              onSubmit={async (name) => {
                await renameFolder(activeFolder.id, name)
                toast.success("フォルダ名を変更しました")
              }}
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="フォルダ名を変更"
                  className="text-muted-foreground"
                >
                  <Pencil />
                </Button>
              }
            />
            <ConfirmDeleteDialog
              title="フォルダを削除しますか?"
              description={`「${activeFolder.name}」を削除します。中の進行は削除されず、未分類に移動します。`}
              onConfirm={() => {
                void deleteFolder(activeFolder.id)
                  .then(() => {
                    setFilter("all")
                    toast.success("フォルダを削除しました")
                  })
                  .catch((e: unknown) =>
                    toast.error(e instanceof Error ? e.message : "削除に失敗しました"),
                  )
              }}
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="フォルダを削除"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              }
            />
          </div>
        )}
      </div>

      {activeFolder && <SongPanel key={activeFolder.id} folder={activeFolder} />}

      {/* 検索・スタイル・並び替え */}
      {saved.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="コード・度数・キー・メモ・曲名で検索"
              aria-label="保存した進行を検索"
              className="pl-8"
            />
          </div>
          <Select
            items={STYLE_FILTER_OPTIONS}
            value={styleFilter}
            onValueChange={(v) => setStyleFilter((v as string) ?? "all")}
          >
            <SelectTrigger aria-label="スタイルで絞り込む">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STYLE_FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select items={SORT_OPTIONS} value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
            <SelectTrigger aria-label="並び順">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {visible.length}件
          </p>
        </div>
      )}

      {!loaded ? (
        <p className="py-12 text-center text-muted-foreground">読み込み中...</p>
      ) : visible.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            {saved.length === 0 ? (
              <>
                <p className="text-muted-foreground">
                  まだ保存された進行がありません。Generatorで気に入った進行を保存しましょう。
                </p>
                <Button onClick={() => navigate("/generator")}>
                  <Sparkles data-icon="inline-start" />
                  Generatorを開く
                </Button>
              </>
            ) : filtersActive ? (
              <>
                <p className="text-muted-foreground">条件に合う進行がありません。</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("")
                    setStyleFilter("all")
                  }}
                >
                  検索条件をクリア
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">このフォルダには進行がありません。</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.slice(0, shownCount).map((p) => (
            <SavedProgressionCard
              key={p.id}
              progression={p}
              action={
                <ConfirmDeleteDialog
                  title="進行を削除しますか?"
                  description={`「${p.chords.join(" – ")}」を削除します。この操作は取り消せません。`}
                  onConfirm={() => void handleDelete(p.id, p.chords.join(" – "))}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="進行を削除"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                      }}
                    >
                      <Trash2 />
                    </Button>
                  }
                />
              }
            />
          ))}
        </div>
        {visible.length > shownCount && (
          <Button variant="outline" className="self-center" onClick={() => setShownCount((n) => n + PAGE_SIZE)}>
            さらに表示({shownCount} / {visible.length}件)
          </Button>
        )}
        </>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center rounded-full border border-border/60 px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-foreground"
          : "text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
