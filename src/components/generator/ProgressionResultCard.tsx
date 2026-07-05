import { Bookmark, BookmarkCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { STYLE_OPTIONS } from "@/features/chord-engine/templates"
import type { GeneratedProgression } from "@/types/progression"
import { MOOD_OPTIONS, SECTION_OPTIONS } from "@/types/music"
import { ScoreBadge } from "./ScoreBadge"

interface Props {
  progression: GeneratedProgression
  saved: boolean
  onSave: () => void
}

export function ProgressionResultCard({ progression, saved, onSave }: Props) {
  const styleLabel = STYLE_OPTIONS.find((s) => s.value === progression.style)?.label
  const sectionLabel = SECTION_OPTIONS.find((s) => s.value === progression.section)?.label
  const moodLabel = MOOD_OPTIONS.find((m) => m.value === progression.mood)?.label

  return (
    <Card className="flex h-full flex-col gap-4 border-border/60">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="font-normal">{progression.key}</Badge>
          <Badge variant="secondary" className="font-normal">{styleLabel}</Badge>
          <Badge variant="secondary" className="font-normal">{sectionLabel}</Badge>
          <Badge variant="outline" className="font-normal">{moodLabel}</Badge>
        </div>
        <p className="font-mono text-lg leading-snug font-medium tracking-tight break-words">
          {progression.chords.join(" – ")}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {progression.romanNumerals.join(" – ")}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Bass: <span className="font-mono">{progression.bassMovement}</span>
        </p>
        <p className="text-sm leading-relaxed text-foreground/85">{progression.description}</p>
        <div className="mt-auto">
          <ScoreBadge scores={progression.scores} compact />
        </div>
      </CardContent>
      <CardFooter>
        <Button
          variant={saved ? "secondary" : "default"}
          className="w-full"
          onClick={onSave}
          disabled={saved}
        >
          {saved ? (
            <>
              <BookmarkCheck data-icon="inline-start" />
              保存済み
            </>
          ) : (
            <>
              <Bookmark data-icon="inline-start" />
              保存する
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
