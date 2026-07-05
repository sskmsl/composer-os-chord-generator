import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { ReactElement } from "react"

interface Props {
  title: string
  description: string
  onConfirm: () => void
  /** ダイアログを開くトリガー要素(ボタン等) */
  trigger: ReactElement
}

export function ConfirmDeleteDialog({ title, description, onConfirm, trigger }: Props) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          {/* Close(内部クローズ)に削除処理を載せて、クリックで確実に閉じる */}
          <AlertDialogCancel variant="destructive" onClick={onConfirm}>
            削除する
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
