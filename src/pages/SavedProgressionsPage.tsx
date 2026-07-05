import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { FolderPlus, Pencil, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog"
import { FolderNameDialog } from "@/components/saved/FolderNameDialog"
import { SavedProgressionCard } from "@/components/saved/SavedProgressionCard"
import { useAppStore } from "@/store/useAppStore"
import { cn } from "@/lib/utils"

/** フォルダ絞り込み: all=すべて / none=未分類 / それ以外はフォルダid */
type FolderFilter = "all" | "none" | string

export function SavedProgressionsPage() {
  const navigate = useNavigate()
  const saved = useAppStore((s) => s.saved)
  const loaded = useAppStore((s) => s.loaded)
  const deleteSaved = useAppStore((s) => s.deleteSaved)
  const folders = useAppStore((s) => s.folders)
  const createFolder = useAppStore((s) => s.createFolder)
  const renameFolder = useAppStore((s) => s.renameFolder)
  const deleteFolder = useAppStore((s) => s.deleteFolder)

  const [filter, setFilter] = useState<FolderFilter>("all")

  const visible = useMemo(() => {
    if (filter === "all") return saved
    if (filter === "none") return saved.filter((p) => p.folderId == null)
    return saved.filter((p) => p.folderId === filter)
  }, [saved, filter])

  const countFor = (f: FolderFilter): number => {
    if (f === "all") return saved.length
    if (f === "none") return saved.filter((p) => p.folderId == null).length
    return saved.filter((p) => p.folderId === f).length
  }

  const activeFolder = folders.find((f) => f.id === filter)

  const handleDelete = async (id: string, chords: string) => {
    try {
      await deleteSaved(id)
      toast.success(`「${chords}」を削除しました`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">Library</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-wide">Saved Progressions</h1>
        </div>
        <Button onClick={() => navigate("/generator")}>
          <Sparkles data-icon="inline-start" />
          新しく生成する
        </Button>
      </div>

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
        {folders.map((f) => (
          <FilterChip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.name}
            <Badge variant="secondary" className="ml-1.5 font-normal">{countFor(f.id)}</Badge>
          </FilterChip>
        ))}
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
            ) : (
              <p className="text-muted-foreground">このフォルダには進行がありません。</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
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
