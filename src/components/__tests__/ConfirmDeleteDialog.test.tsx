// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ConfirmDeleteDialog } from "../ConfirmDeleteDialog"

describe("ConfirmDeleteDialog", () => {
  it("calls onConfirm when the confirm button is clicked", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmDeleteDialog
        title="Delete?"
        description="Are you sure?"
        onConfirm={onConfirm}
        trigger={<button>削除</button>}
      />,
    )
    await user.click(screen.getByRole("button", { name: "削除" }))
    await user.click(await screen.findByRole("button", { name: "削除する" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("does not call onConfirm when cancel is clicked", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmDeleteDialog
        title="Delete?"
        description="Are you sure?"
        onConfirm={onConfirm}
        trigger={<button>削除</button>}
      />,
    )
    await user.click(screen.getByRole("button", { name: "削除" }))
    await user.click(await screen.findByRole("button", { name: "キャンセル" }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("uses a custom confirm label when provided", async () => {
    const user = userEvent.setup()
    render(
      <ConfirmDeleteDialog
        title="Restore?"
        description="Replace local data?"
        onConfirm={() => {}}
        confirmLabel="復元する"
        trigger={<button>復元</button>}
      />,
    )
    await user.click(screen.getByRole("button", { name: "復元" }))
    expect(await screen.findByRole("button", { name: "復元する" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "削除する" })).toBeNull()
  })

  it("regression: clicking confirm does not bubble to an ancestor's onClick (Portal + React synthetic event bubbling)", async () => {
    // AlertDialogContentはdocument.body直下にPortal描画されるが、Reactの合成
    // イベントはDOMツリーではなくコンポーネントツリーに沿ってバブリングするため、
    // stopPropagationがないと、削除ボタンを内包する祖先要素(カード等)のonClickまで
    // 発火してしまい、例えば削除直後に詳細ページへ誤遷移するバグを引き起こしていた。
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onAncestorClick = vi.fn()
    render(
      <div onClick={onAncestorClick}>
        <ConfirmDeleteDialog
          title="Delete?"
          description="Are you sure?"
          onConfirm={onConfirm}
          trigger={
            <button
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              削除
            </button>
          }
        />
      </div>,
    )

    await user.click(screen.getByRole("button", { name: "削除" }))
    await user.click(await screen.findByRole("button", { name: "削除する" }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onAncestorClick).not.toHaveBeenCalled()
  })
})
