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
import type { MouseEvent, ReactElement } from "react"

interface Props {
  title: string
  description: string
  onConfirm: () => void
  /** ダイアログを開くトリガー要素(ボタン等) */
  trigger: ReactElement
  /** 確定ボタンのラベル(既定: "削除する") */
  confirmLabel?: string
}

export function ConfirmDeleteDialog({ title, description, onConfirm, trigger, confirmLabel }: Props) {
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
          {/*
            Close(内部クローズ)に削除処理を載せて、クリックで確実に閉じる。
            AlertDialogContentはPortalでdocument.body直下に描画されるが、Reactの
            合成イベントはDOMツリーではなくコンポーネントツリーに沿ってバブリングする
            ため、stopPropagationしないとカード等トリガーの祖先要素のonClick(詳細
            ページへの遷移等)まで届いてしまう。
          */}
          <AlertDialogCancel
            variant="destructive"
            onClick={(e: MouseEvent) => {
              e.stopPropagation()
              onConfirm()
            }}
          >
            {confirmLabel ?? "削除する"}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
