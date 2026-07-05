import { useRef, useState, type ReactElement } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { useAppStore } from "@/store/useAppStore"

interface Props {
  title: string
  description?: string
  initialName?: string
  submitLabel: string
  onSubmit: (name: string) => Promise<void>
  trigger: ReactElement
}

/**
 * フォルダ(曲)の作成・リネーム用の名前入力ダイアログ。
 * 重複チェックは入力中に行い、確定はダイアログの内部クローズに任せる
 * (base-ui Dialog の制御クローズでオーバーレイが残留する問題を回避するため
 *  AlertDialog プリミティブを使用)。
 */
export function FolderNameDialog({
  title,
  description,
  initialName = "",
  submitLabel,
  onSubmit,
  trigger,
}: Props) {
  const folders = useAppStore((s) => s.folders)
  const [name, setName] = useState(initialName)
  const submitRef = useRef<HTMLButtonElement>(null)

  const trimmed = name.trim()
  const duplicate =
    trimmed !== "" && trimmed !== initialName.trim() && folders.some((f) => f.name === trimmed)
  const valid = trimmed !== "" && !duplicate

  const handleSubmit = () => {
    if (!valid) return
    void onSubmit(trimmed).catch((e: unknown) => {
      toast.error(e instanceof Error ? e.message : "操作に失敗しました")
    })
  }

  return (
    <AlertDialog onOpenChange={(open) => open && setName(initialName)}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 夜のハイウェイ"
            aria-label="フォルダ名"
            aria-invalid={duplicate}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) {
                e.preventDefault()
                submitRef.current?.click()
              }
            }}
            autoFocus
          />
          {duplicate && <p className="text-xs text-destructive">同名のフォルダがあります</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          {/* Close(内部クローズ)にsubmit処理を載せて、クリックで確実に閉じる */}
          <AlertDialogCancel
            ref={submitRef}
            variant="default"
            disabled={!valid}
            onClick={handleSubmit}
          >
            {submitLabel}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
