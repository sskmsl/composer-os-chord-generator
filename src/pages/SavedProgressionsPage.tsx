import { useNavigate } from "react-router-dom"
import { Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog"
import { SavedProgressionCard } from "@/components/saved/SavedProgressionCard"
import { useAppStore } from "@/store/useAppStore"

export function SavedProgressionsPage() {
  const navigate = useNavigate()
  const saved = useAppStore((s) => s.saved)
  const loaded = useAppStore((s) => s.loaded)
  const deleteSaved = useAppStore((s) => s.deleteSaved)

  const handleDelete = async (id: string, chords: string) => {
    try {
      await deleteSaved(id)
      toast.success(`「${chords}」を削除しました`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました")
    }
  }

  return (
    <div className="flex flex-col gap-8">
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

      {!loaded ? (
        <p className="py-12 text-center text-muted-foreground">読み込み中...</p>
      ) : saved.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-muted-foreground">
              まだ保存された進行がありません。Generatorで気に入った進行を保存しましょう。
            </p>
            <Button onClick={() => navigate("/generator")}>
              <Sparkles data-icon="inline-start" />
              Generatorを開く
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((p) => (
            <div key={p.id} className="relative">
              <SavedProgressionCard progression={p} />
              <div className="absolute top-3 right-3">
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
                    >
                      <Trash2 />
                    </Button>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
