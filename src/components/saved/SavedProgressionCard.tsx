import { useNavigate } from "react-router-dom"
import { Folder, Play, Square } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { STYLE_OPTIONS } from "@/features/chord-engine/templates"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"
import { usePlayerStore } from "@/store/usePlayerStore"
import type { SavedProgression } from "@/types/progression"
import { MOOD_OPTIONS, SECTION_OPTIONS, sectionBadgeClass } from "@/types/music"
import { formatDate } from "@/utils/date"

interface Props {
  progression: SavedProgression
  /** ヘッダー右側に追加表示するアクション(削除ボタン等)。クリックは stopPropagation すること */
  action?: React.ReactNode
}

export function SavedProgressionCard({ progression, action }: Props) {
  const navigate = useNavigate()
  const styleLabel = STYLE_OPTIONS.find((s) => s.value === progression.style)?.label
  const sectionLabel = SECTION_OPTIONS.find((s) => s.value === progression.section)?.label
  const moodLabel = MOOD_OPTIONS.find((m) => m.value === progression.mood)?.label
  const playingId = usePlayerStore((s) => s.playingId)
  const play = usePlayerStore((s) => s.play)
  const playing = playingId === progression.id
  const folders = useAppStore((s) => s.folders)
  const folderName = progression.folderId
    ? folders.find((f) => f.id === progression.folderId)?.name
    : undefined

  const openDetail = () => navigate(`/saved/${progression.id}`)

  return (
    <Card
      role="link"
      tabIndex={0}
      aria-label={`${progression.chords.join(" – ")} の詳細`}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) openDetail()
      }}
      className="h-full cursor-pointer gap-3 border-border/60 transition-colors outline-none hover:border-primary/40 focus-visible:border-ring"
    >
      <CardHeader className="gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 font-mono text-base leading-snug font-medium tracking-tight break-words">
            {progression.chords.join(" – ")}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-primary"
              aria-label={playing ? "停止" : "試聴"}
              onClick={(e) => {
                e.stopPropagation()
                play(progression.id, progression.chords, progression.style)
              }}
            >
              {playing ? <Square /> : <Play />}
            </Button>
            {action}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {folderName && (
            <Badge variant="outline" className="gap-1 border-primary/40 font-normal text-primary">
              <Folder className="size-3" />
              {folderName}
            </Badge>
          )}
          <Badge variant="secondary" className="font-normal">{progression.key}</Badge>
          <Badge variant="secondary" className="font-normal">{styleLabel}</Badge>
          <Badge variant="outline" className={cn("font-normal", sectionBadgeClass(progression.section))}>
            {sectionLabel}
          </Badge>
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
  )
}
