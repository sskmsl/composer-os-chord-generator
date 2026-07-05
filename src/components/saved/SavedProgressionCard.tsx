import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { STYLE_OPTIONS } from "@/features/chord-engine/templates"
import type { SavedProgression } from "@/types/progression"
import { MOOD_OPTIONS, SECTION_OPTIONS } from "@/types/music"
import { formatDate } from "@/utils/date"

export function SavedProgressionCard({ progression }: { progression: SavedProgression }) {
  const styleLabel = STYLE_OPTIONS.find((s) => s.value === progression.style)?.label
  const sectionLabel = SECTION_OPTIONS.find((s) => s.value === progression.section)?.label
  const moodLabel = MOOD_OPTIONS.find((m) => m.value === progression.mood)?.label

  return (
    <Link to={`/saved/${progression.id}`} className="group block h-full outline-none">
      <Card className="h-full gap-3 border-border/60 transition-colors group-hover:border-primary/40 group-focus-visible:border-ring">
        <CardHeader className="gap-2.5">
          <p className="font-mono text-base leading-snug font-medium tracking-tight break-words">
            {progression.chords.join(" – ")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="font-normal">{progression.key}</Badge>
            <Badge variant="secondary" className="font-normal">{styleLabel}</Badge>
            <Badge variant="secondary" className="font-normal">{sectionLabel}</Badge>
            <Badge variant="outline" className="font-normal">{moodLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {progression.memo && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{progression.memo}</p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono">
              M{progression.scores.mylene} / B{progression.scores.boutonnat} / C
              {progression.scores.cinematic}
            </span>
            <span>{formatDate(progression.savedAt)} 保存</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
