import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, ChevronUp, Copy, Download, FileJson, Music, Play, Square, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { resolveTempo, songBarCount, songSections } from "@/features/midi/exportSong"
import { toastWithUndo } from "@/lib/undoToast"
import { usePlayerStore } from "@/store/usePlayerStore"
import { useAppStore } from "@/store/useAppStore"
import type { Folder } from "@/types/folder"
import { SECTION_OPTIONS } from "@/types/music"

const REPEAT_OPTIONS = [1, 2, 3, 4]

/** フォルダ(= 1曲)の構成を組み立てて SMF 書き出しするパネル */
export function SongPanel({ folder }: { folder: Folder }) {
  const saved = useAppStore((s) => s.saved)
  const setFolderTempo = useAppStore((s) => s.setFolderTempo)
  const setFolderMemo = useAppStore((s) => s.setFolderMemo)
  const setRepeatCount = useAppStore((s) => s.setRepeatCount)
  const reorderSection = useAppStore((s) => s.reorderSection)
  const exportFolderAsMidi = useAppStore((s) => s.exportFolderAsMidi)
  const exportFolderForArranger = useAppStore((s) => s.exportFolderForArranger)
  const deleteSaved = useAppStore((s) => s.deleteSaved)
  const duplicateSection = useAppStore((s) => s.duplicateSection)
  const play = usePlayerStore((s) => s.play)
  const playingId = usePlayerStore((s) => s.playingId)
  const playSequence = usePlayerStore((s) => s.playSequence)
  const playingSegment = usePlayerStore((s) => s.playingSegment)

  const sections = useMemo(() => songSections(folder, saved), [folder, saved])
  const bars = songBarCount(sections)
  const effectiveTempo = resolveTempo(folder, sections)
  const songPlayId = `song:${folder.id}`
  // 曲全体の試聴では繰り返しも展開して鳴らす。鳴っている箇所がどのセクションかを引くための対応表
  const songSegments = useMemo(
    () => sections.flatMap((section) => Array.from({ length: Math.max(1, section.repeatCount) }, () => section)),
    [sections],
  )
  const playingSectionId =
    playingId === songPlayId && playingSegment !== null ? songSegments[playingSegment]?.id ?? null : null

  const [tempoInput, setTempoInput] = useState(folder.tempo ? String(folder.tempo) : "")
  const [memoInput, setMemoInput] = useState(folder.memo ?? "")

  const commitTempo = () => {
    const trimmed = tempoInput.trim()
    if (trimmed === "") {
      void setFolderTempo(folder.id, undefined)
      return
    }
    const n = Number(trimmed)
    if (Number.isFinite(n) && n >= 20 && n <= 300) {
      void setFolderTempo(folder.id, Math.round(n))
    } else {
      toast.error("テンポは 20〜300 で入力してください")
      setTempoInput(folder.tempo ? String(folder.tempo) : "")
    }
  }

  const commitMemo = () => {
    if (memoInput === (folder.memo ?? "")) return
    void setFolderMemo(folder.id, memoInput)
  }

  const handleExport = () => {
    if (sections.length === 0) {
      toast.info("この曲にはまだセクションがありません")
      return
    }
    try {
      exportFolderAsMidi(folder.id)
      toast.success(`「${folder.name}.mid」を書き出しました`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "書き出しに失敗しました")
    }
  }

  const handleArrangerExport = () => {
    if (sections.length === 0) {
      toast.info("この曲にはまだセクションがありません")
      return
    }
    try {
      exportFolderForArranger(folder.id)
      toast.success("Composer Arranger用JSONを書き出しました")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "書き出しに失敗しました")
    }
  }

  const handleDelete = async (id: string, chords: string) => {
    try {
      const token = await deleteSaved(id)
      toastWithUndo(`「${chords}」を削除しました`, token)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました")
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateSection(id)
      toast.success("セクションを複製しました")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "複製に失敗しました")
    }
  }

  if (sections.length === 0) return null

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base tracking-wide">
            <Music className="size-4 text-primary" />
            曲の構成 — {folder.name}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="song-tempo" className="text-xs text-muted-foreground">
                Tempo
              </Label>
              <Input
                id="song-tempo"
                value={tempoInput}
                onChange={(e) => setTempoInput(e.target.value)}
                onBlur={commitTempo}
                onKeyDown={(e) => e.key === "Enter" && commitTempo()}
                inputMode="numeric"
                placeholder={String(effectiveTempo)}
                className="h-8 w-20"
                aria-label="曲のテンポ(BPM)"
              />
              <span className="text-xs text-muted-foreground">BPM</span>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                playSequence(
                  songPlayId,
                  songSegments.map((s) => ({ chords: s.chords, beats: s.beats, style: s.style })),
                  effectiveTempo,
                )
              }
            >
              {playingId === songPlayId ? <Square data-icon="inline-start" /> : <Play data-icon="inline-start" />}
              {playingId === songPlayId ? "停止" : "曲全体を試聴"}
            </Button>
            <Button onClick={handleExport}>
              <Download data-icon="inline-start" />
              MIDI書き出し
            </Button>
            <Button variant="outline" onClick={handleArrangerExport}>
              <FileJson data-icon="inline-start" />
              Arranger用JSON
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {sections.length}セクション / 約{bars}小節 · SMF Type 1 (.mid) · 和声のリズムは可変
          (基本4拍、経過和音は短く終止は長く) · Logic Proにインポート可能
          {!folder.tempo && `(テンポ未設定のため ${effectiveTempo} BPM で試聴・書き出し)`}
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="song-memo" className="text-xs text-muted-foreground">
            曲のメモ
          </Label>
          <Textarea
            id="song-memo"
            value={memoInput}
            onChange={(e) => setMemoInput(e.target.value)}
            onBlur={commitMemo}
            placeholder="構成の意図、アレンジのアイデアなど"
            rows={2}
            className="resize-none bg-card/60 text-sm leading-relaxed"
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {sections.map((section, i) => {
          const label = SECTION_OPTIONS.find((s) => s.value === section.section)?.label
          return (
            <div
              key={section.id}
              aria-current={playingSectionId === section.id ? "step" : undefined}
              className={`flex flex-col gap-2 rounded-lg border bg-card px-3 py-2 transition-colors sm:flex-row sm:items-center sm:gap-3 ${
                playingSectionId === section.id ? "border-primary ring-1 ring-primary/40" : "border-border/60"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    aria-label="上へ移動"
                    disabled={i === 0}
                    onClick={() => void reorderSection(section.id, "up")}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="下へ移動"
                    disabled={i === sections.length - 1}
                    onClick={() => void reorderSection(section.id, "down")}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
                <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-normal">{label}</Badge>
                    <Badge variant="outline" className="font-normal">{section.key}</Badge>
                    <Link
                      to={`/saved/${section.id}`}
                      className="truncate font-mono text-sm hover:text-primary hover:underline"
                    >
                      {section.chords.join(" – ")}
                    </Link>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <button
                  type="button"
                  aria-label="このセクションを試聴"
                  // 曲の中のセクションは、スタイルの標準テンポではなく曲のテンポで鳴らす
                  onClick={() => play(section.id, section.chords, section.style, section.beats, effectiveTempo)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {playingId === section.id ? "停止" : "試聴"}
                </button>
                <button
                  type="button"
                  aria-label="このセクションから曲の最後まで試聴"
                  onClick={() =>
                    playSequence(
                      songPlayId,
                      songSegments.map((s) => ({ chords: s.chords, beats: s.beats, style: s.style })),
                      effectiveTempo,
                      // 繰り返しを展開した並びでの、このセクションの最初の位置
                      songSegments.findIndex((s) => s.id === section.id),
                    )
                  }
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  ここから
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">繰返</Label>
                  <Select
                    items={REPEAT_OPTIONS.map((r) => ({ value: String(r), label: `×${r}` }))}
                    value={String(section.repeatCount)}
                    onValueChange={(v) => void setRepeatCount(section.id, Number(v))}
                  >
                    <SelectTrigger size="sm" aria-label="繰り返し回数">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPEAT_OPTIONS.map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          ×{r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="このセクションを複製"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => void handleDuplicate(section.id)}
                >
                  <Copy />
                </Button>
                <ConfirmDeleteDialog
                  title="セクションを削除しますか?"
                  description={`「${section.chords.join(" – ")}」を曲の構成から削除します。削除後しばらくは、通知の「元に戻す」で取り消せます。`}
                  onConfirm={() => void handleDelete(section.id, section.chords.join(" – "))}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="このセクションを削除"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  }
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
