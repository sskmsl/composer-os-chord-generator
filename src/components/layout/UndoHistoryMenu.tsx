import { useEffect, useRef, useState } from "react"
import { History, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { useAppStore } from "@/store/useAppStore"
import { cn } from "@/lib/utils"

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
}

/** 入力欄の中では Ctrl+Z / ⌘Z を文字の取り消しに任せる */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

/**
 * ヘッダーの「操作履歴」。直近30件の操作を新しい順に並べ、どれでも個別に元に戻せる。
 * 入力欄の外では Ctrl+Z(Macは⌘Z)で最後の操作を元に戻す。
 */
export function UndoHistoryMenu() {
  const history = useAppStore((s) => s.undoHistory)
  const undo = useAppStore((s) => s.undo)
  const undoLatest = useAppStore((s) => s.undoLatest)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "z") return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      void undoLatest().then((label) => {
        if (label) toast.success(`元に戻しました: ${label}`)
      })
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [undoLatest])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onEscape)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onEscape)
    }
  }, [open])

  const handleUndo = async (token: string, label: string) => {
    try {
      if (await undo(token)) toast.success(`元に戻しました: ${label}`)
      else toast.error("これ以上は元に戻せません")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "元に戻せませんでした")
    }
  }

  return (
    <div ref={containerRef} className="relative ml-auto shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
          open && "bg-accent text-accent-foreground",
        )}
        title="操作履歴(入力欄の外では Ctrl+Z / ⌘Z で最後の操作を元に戻せます)"
      >
        <History className="size-4" />
        <span className="hidden sm:inline">操作履歴</span>
        {history.length > 0 && <span className="tabular-nums text-xs">({history.length})</span>}
      </button>
      {open && (
        // ヘッダーは横スクロールするため absolute だと切れる。fixed でヘッダーの直下に出す
        // (ヘッダーの backdrop-blur が fixed の基準になるので、ヘッダーの右端・下端に揃う)
        <div
          role="menu"
          className="fixed top-16 right-2 left-2 z-50 max-h-[70vh] overflow-y-auto rounded-lg border border-border/60 bg-popover p-1.5 shadow-xl sm:right-4 sm:left-auto sm:w-96"
        >
          {history.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">元に戻せる操作はまだありません。</p>
          ) : (
            <>
              <p className="px-3 pt-1 pb-2 text-xs text-muted-foreground">
                新しい順・最大30件。その操作で変わった項目だけを元に戻します。
              </p>
              {history.map((item) => (
                <div key={item.token} role="menuitem" className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent/60">
                  <span className="w-11 shrink-0 text-xs tabular-nums text-muted-foreground">{formatTime(item.at)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                  <button
                    type="button"
                    onClick={() => void handleUndo(item.token, item.label)}
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Undo2 className="size-3.5" />
                    元に戻す
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
