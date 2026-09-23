import { toast } from "sonner"
import { useAppStore } from "@/store/useAppStore"

/** 完了の通知に「元に戻す」ボタンを付ける。token は store の操作が返す取り消し用トークン */
export function toastWithUndo(message: string, token: string): void {
  toast.success(message, {
    duration: 8000,
    action: {
      label: "元に戻す",
      onClick: () => {
        void useAppStore
          .getState()
          .undo(token)
          .then((undone) => (undone ? toast.success("元に戻しました") : toast.error("これ以上は元に戻せません")))
          .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "元に戻せませんでした"))
      },
    },
  })
}
