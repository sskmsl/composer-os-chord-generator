import { useState } from "react"
import { Bookmark, BookmarkCheck, Piano, Play, Square } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { STYLE_OPTIONS } from "@/features/chord-engine/templates"
import { usePlayerStore } from "@/store/usePlayerStore"
import type { GeneratedProgression } from "@/types/progression"
import { MOOD_OPTIONS, SECTION_OPTIONS } from "@/types/music"
import { ChordKeyboard } from "./ChordKeyboard"
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
  const playingId = usePlayerStore((s) => s.playingId)
  const play = usePlayerStore((s) => s.play)
  const playing = playingId === progression.id
  const [showKeys, setShowKeys] = useState(false)

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
        {showKeys && (
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
            {progression.chords.map((chord, i) => (
              <ChordKeyboard key={`${chord}-${i}`} symbol={chord} />
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Bass: <span className="font-mono">{progression.bassMovement}</span>
        </p>
        <p className="text-sm leading-relaxed text-foreground/85">{progression.description}</p>
        <div className="mt-auto">
          <ScoreBadge scores={progression.scores} compact />
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          variant={showKeys ? "secondary" : "outline"}
          size="icon"
          className="shrink-0"
          onClick={() => setShowKeys((v) => !v)}
          aria-label={showKeys ? "鍵盤を隠す" : "鍵盤を表示"}
          aria-pressed={showKeys}
        >
          <Piano />
        </Button>
        <Button
          variant="outline"
          className="shrink-0"
          onClick={() => play(progression.id, progression.chords, progression.style)}
          aria-label={playing ? "停止" : "試聴"}
        >
          {playing ? (
            <>
              <Square data-icon="inline-start" />
              停止
            </>
          ) : (
            <>
              <Play data-icon="inline-start" />
              試聴
            </>
          )}
        </Button>
        <Button
          variant={saved ? "secondary" : "default"}
          className="flex-1"
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
