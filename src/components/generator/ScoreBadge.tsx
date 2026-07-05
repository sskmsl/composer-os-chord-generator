import type { Scores } from "@/types/progression"
import { cn } from "@/lib/utils"

const SCORE_LABELS: { key: keyof Scores; label: string }[] = [
  { key: "mylene", label: "Mylène" },
  { key: "boutonnat", label: "Boutonnat" },
  { key: "melancholy", label: "Melancholy" },
  { key: "darkness", label: "Darkness" },
  { key: "cinematic", label: "Cinematic" },
]

/** 5軸スコアの横バー表示(1〜10) */
export function ScoreBadge({ scores, compact }: { scores: Scores; compact?: boolean }) {
  return (
    <div className={cn("grid gap-1.5", compact && "gap-1")}>
      {SCORE_LABELS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-[0.65rem] tracking-wider text-muted-foreground uppercase">
            {label}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/80"
              style={{ width: `${scores[key] * 10}%` }}
            />
          </div>
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-foreground/80">
            {scores[key]}
          </span>
        </div>
      ))}
    </div>
  )
}
