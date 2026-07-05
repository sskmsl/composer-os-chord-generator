import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Play, Save, Square, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog"
import { ScoreBadge } from "@/components/generator/ScoreBadge"
import { STYLE_OPTIONS } from "@/features/chord-engine/templates"
import { useAppStore } from "@/store/useAppStore"
import { usePlayerStore } from "@/store/usePlayerStore"
import { MOOD_OPTIONS, SECTION_OPTIONS } from "@/types/music"
import { formatDate } from "@/utils/date"

interface MemoFields {
  memo: string
  songIdea: string
  arrangementNote: string
  logicProNote: string
}

const MEMO_FIELDS: { key: keyof MemoFields; label: string; placeholder: string }[] = [
  { key: "memo", label: "メモ", placeholder: "この進行の印象、使いたい場面など" },
  { key: "songIdea", label: "想定する曲アイデア", placeholder: "タイトル案、テーマ、歌詞の断片など" },
  { key: "arrangementNote", label: "アレンジメモ", placeholder: "ストリングス、パッド、ベースの動きなど" },
  { key: "logicProNote", label: "Logic Pro メモ", placeholder: "使う音源、テンポ、プロジェクト名など" },
]

export function ProgressionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const saved = useAppStore((s) => s.saved)
  const loaded = useAppStore((s) => s.loaded)
  const updateSaved = useAppStore((s) => s.updateSaved)
  const deleteSaved = useAppStore((s) => s.deleteSaved)
  const playingId = usePlayerStore((s) => s.playingId)
  const play = usePlayerStore((s) => s.play)

  const progression = saved.find((p) => p.id === id)

  const [fields, setFields] = useState<MemoFields>({
    memo: "",
    songIdea: "",
    arrangementNote: "",
    logicProNote: "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (progression) {
      setFields({
        memo: progression.memo,
        songIdea: progression.songIdea,
        arrangementNote: progression.arrangementNote,
        logicProNote: progression.logicProNote,
      })
    }
  }, [progression])

  if (!loaded) {
    return <p className="py-12 text-center text-muted-foreground">読み込み中...</p>
  }
  if (!progression) {
    return (
      <div className="flex flex-col items-center gap-6 py-24 text-center">
        <h1 className="text-xl font-semibold">進行が見つかりません</h1>
        <Button variant="outline" render={<Link to="/saved" />}>
          保存済み一覧へ戻る
        </Button>
      </div>
    )
  }

  const dirty =
    fields.memo !== progression.memo ||
    fields.songIdea !== progression.songIdea ||
    fields.arrangementNote !== progression.arrangementNote ||
    fields.logicProNote !== progression.logicProNote

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSaved(progression.id, fields)
      toast.success("メモを保存しました")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteSaved(progression.id)
      toast.success("進行を削除しました")
      navigate("/saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました")
    }
  }

  const styleLabel = STYLE_OPTIONS.find((s) => s.value === progression.style)?.label
  const sectionLabel = SECTION_OPTIONS.find((s) => s.value === progression.section)?.label
  const moodLabel = MOOD_OPTIONS.find((m) => m.value === progression.mood)?.label

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
          render={<Link to="/saved" />}
        >
          <ArrowLeft data-icon="inline-start" />
          保存済み一覧
        </Button>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-mono text-2xl font-semibold tracking-tight break-words sm:text-3xl">
              {progression.chords.join(" – ")}
            </h1>
            <p className="mt-2 font-mono text-sm text-muted-foreground">
              {progression.romanNumerals.join(" – ")}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="font-normal">{progression.key}</Badge>
              <Badge variant="secondary" className="font-normal">{styleLabel}</Badge>
              <Badge variant="secondary" className="font-normal">{sectionLabel}</Badge>
              <Badge variant="outline" className="font-normal">{moodLabel}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => play(progression.id, progression.chords, progression.style)}
            >
              {playingId === progression.id ? (
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
            <ConfirmDeleteDialog
              title="進行を削除しますか?"
              description={`「${progression.chords.join(" – ")}」を削除します。この操作は取り消せません。`}
              onConfirm={() => void handleDelete()}
              trigger={
                <Button variant="destructive" size="icon" aria-label="進行を削除">
                  <Trash2 />
                </Button>
              }
            />
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base tracking-wide">進行の特徴</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-xs tracking-wider text-muted-foreground uppercase">Bass</p>
              <p className="mt-1 font-mono text-sm">{progression.bassMovement}</p>
            </div>
            <div>
              <p className="text-xs tracking-wider text-muted-foreground uppercase">説明</p>
              <p className="mt-1 text-sm leading-relaxed">{progression.description}</p>
            </div>
            <div>
              <p className="mb-2 text-xs tracking-wider text-muted-foreground uppercase">Scores</p>
              <ScoreBadge scores={progression.scores} />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(progression.savedAt)} 保存
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base tracking-wide">ノート</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {MEMO_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} className="flex flex-col gap-2">
                <Label htmlFor={`memo-${key}`}>{label}</Label>
                <Textarea
                  id={`memo-${key}`}
                  value={fields[key]}
                  onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  rows={3}
                  className="leading-relaxed"
                />
              </div>
            ))}
            <Button onClick={handleSave} disabled={!dirty || saving} className="self-end">
              <Save data-icon="inline-start" />
              {saving ? "保存中..." : "メモを保存"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
