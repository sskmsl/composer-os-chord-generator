import { ArrowRight, Lightbulb } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NEXT_SECTIONS, resolveKeyMove, TYPICAL_SONG_FLOW } from "@/features/chord-engine/songFlow"
import { useAppStore } from "@/store/useAppStore"
import { keyLabel, SECTION_OPTIONS } from "@/types/music"
import { cn } from "@/lib/utils"

/**
 * 現在のセクションに対する「次のセクション」の提案。
 * クリックするとセクションを切り替えてそのまま生成する。
 */
export function NextSectionSuggestion() {
  const params = useAppStore((s) => s.params)
  const setParams = useAppStore((s) => s.setParams)
  const generate = useAppStore((s) => s.generate)

  const suggestions = NEXT_SECTIONS[params.section]
  if (suggestions.length === 0) return null

  const currentLabel = SECTION_OPTIONS.find((s) => s.value === params.section)?.label

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/30 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lightbulb className="size-4 text-primary" />
        <span>
          {currentLabel} の次におすすめの流れ
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map(({ section, reason, keyMove }) => {
          const label = SECTION_OPTIONS.find((s) => s.value === section)?.label
          const targetKey = keyMove ? resolveKeyMove(params.key, keyMove.type) : params.key
          const keyChanges = keyMove && keyLabel(targetKey) !== keyLabel(params.key)
          return (
            <Button
              key={section}
              variant="outline"
              className="h-auto flex-col items-start gap-0.5 px-3 py-2 text-left"
              onClick={() => {
                setParams(keyChanges ? { section, key: targetKey } : { section })
                generate()
                // 新しい結果一覧の先頭が見えるようページ上部へ戻す
                window.scrollTo({ top: 0, behavior: "smooth" })
              }}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <ArrowRight className="size-3.5 text-primary" />
                {label} を生成
                {keyChanges && (
                  <Badge variant="outline" className="border-primary/40 font-normal text-primary">
                    Key: {keyLabel(targetKey)}
                  </Badge>
                )}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {keyChanges ? `${reason}(${keyMove.reason})` : reason}
              </span>
            </Button>
          )
        })}
      </div>
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto text-[0.7rem] text-muted-foreground/70">
        <span className="shrink-0 tracking-wider uppercase">王道構成:</span>
        {TYPICAL_SONG_FLOW.map((step, i) => (
          <span key={i} className="flex shrink-0 items-center gap-1">
            {i > 0 && <span>→</span>}
            <span
              className={cn(
                "whitespace-nowrap",
                step.section === params.section && "font-semibold text-primary",
              )}
            >
              {step.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
