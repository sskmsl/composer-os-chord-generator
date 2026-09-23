import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Pencil, Play, Save, Square, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog"
import { ChordKeyboard } from "@/components/generator/ChordKeyboard"
import { ScoreBadge } from "@/components/generator/ScoreBadge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { parseChordSymbol } from "@/features/audio/chordSymbols"
import { reanalyzeChords, transposeProgression } from "@/features/chord-engine/generateProgressions"
import { STYLE_OPTIONS } from "@/features/chord-engine/templates"
import { toastWithUndo } from "@/lib/undoToast"
import { useAppStore } from "@/store/useAppStore"
import { usePlayerStore } from "@/store/usePlayerStore"
import { keyFromLabel, keyId, keyLabel, MAJOR_KEYS, MINOR_KEYS, MOOD_OPTIONS, SECTION_OPTIONS } from "@/types/music"
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
  const folders = useAppStore((s) => s.folders)
  const moveToFolder = useAppStore((s) => s.moveToFolder)
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
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null)
  const [editingChords, setEditingChords] = useState(false)
  const [chordInputs, setChordInputs] = useState<string[]>([])
  const [savingChords, setSavingChords] = useState(false)
  const loadedProgressionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!progression) {
      loadedProgressionIdRef.current = null
      return
    }
    if (loadedProgressionIdRef.current === progression.id) return

    loadedProgressionIdRef.current = progression.id
    setFields({
      memo: progression.memo,
      songIdea: progression.songIdea,
      arrangementNote: progression.arrangementNote,
      logicProNote: progression.logicProNote,
    })
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

  const handleSave = async (auto = false) => {
    setSaving(true)
    try {
      await updateSaved(progression.id, fields)
      // 入力欄から離れたときの自動保存は、トーストを出さず欄の下の表示だけで知らせる
      if (auto) setAutoSavedAt(new Date())
      else toast.success("メモを保存しました")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  const startEditChords = () => {
    setChordInputs([...progression.chords])
    setEditingChords(true)
  }

  const saveChords = async () => {
    const trimmed = chordInputs.map((c) => c.trim())
    if (trimmed.some((c) => c === "")) {
      toast.error("空のコードがあります")
      return
    }
    const invalid = trimmed.filter((c) => !parseChordSymbol(c))
    if (invalid.length > 0) {
      toast.error(`認識できないコードがあります: ${invalid.join(", ")}`)
      return
    }
    setSavingChords(true)
    try {
      // 度数表記・スコア・説明文もコードに合わせて計算し直す(元の進行のまま残さない)
      const reanalyzed = reanalyzeChords(trimmed, {
        key: keyFromLabel(progression.key, progression.mode),
        style: progression.style,
        mood: progression.mood,
        section: progression.section,
      })
      const token = await updateSaved(progression.id, { chords: trimmed, ...(reanalyzed ?? {}) })
      setEditingChords(false)
      toastWithUndo("コードを変更しました", token)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setSavingChords(false)
    }
  }

  const currentKey = keyFromLabel(progression.key, progression.mode)
  // 曲の流れで転調した先など、一覧にない調で保存された進行でも現在の調を選択肢に残す
  const listedKeys = progression.mode === "minor" ? MINOR_KEYS : MAJOR_KEYS
  const keyOptions = listedKeys.some((k) => k.tonic === currentKey.tonic) ? listedKeys : [currentKey, ...listedKeys]

  const handleTranspose = async (tonic: string) => {
    if (currentKey.tonic === tonic) return
    try {
      const token = await updateSaved(
        progression.id,
        transposeProgression(progression.romanNumerals, { tonic, mode: progression.mode }),
      )
      toastWithUndo(`${keyLabel({ tonic, mode: progression.mode })} に移調しました`, token)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "移調に失敗しました")
    }
  }

  const handleDelete = async () => {
    try {
      const token = await deleteSaved(progression.id)
      toastWithUndo("進行を削除しました", token)
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
            {editingChords ? (
              <div className="flex flex-wrap items-center gap-2">
                {chordInputs.map((c, i) => (
                  <Input
                    key={i}
                    value={c}
                    onChange={(e) =>
                      setChordInputs((arr) => arr.map((v, idx) => (idx === i ? e.target.value : v)))
                    }
                    aria-label={`コード${i + 1}`}
                    className="w-28 font-mono"
                  />
                ))}
                <Button size="sm" onClick={() => void saveChords()} disabled={savingChords}>
                  <Save data-icon="inline-start" />
                  {savingChords ? "保存中..." : "保存"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingChords(false)}
                  disabled={savingChords}
                >
                  <X data-icon="inline-start" />
                  キャンセル
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-2xl font-semibold tracking-tight break-words sm:text-3xl">
                  {progression.chords.join(" – ")}
                </h1>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="コードを編集"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={startEditChords}
                >
                  <Pencil />
                </Button>
              </div>
            )}
            <p className="mt-2 font-mono text-sm text-muted-foreground">
              {progression.romanNumerals.join(" – ")}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {/* 同じ度数のまま別の調へ移す(曲の中で転調させたいセクション向け) */}
              <Select
                items={keyOptions.map((k) => ({
                  value: k.tonic,
                  label: keyLabel(k),
                }))}
                value={currentKey.tonic}
                onValueChange={(v) => void handleTranspose(v as string)}
                disabled={editingChords}
              >
                <SelectTrigger size="sm" aria-label="キー(移調)" className="h-6 gap-1 px-2 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {keyOptions.map((k) => (
                    <SelectItem key={keyId(k)} value={k.tonic}>
                      {keyLabel(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="font-normal">{styleLabel}</Badge>
              <Badge variant="secondary" className="font-normal">{sectionLabel}</Badge>
              <Badge variant="outline" className="font-normal">{moodLabel}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => play(progression.id, progression.chords, progression.style, progression.beats)}
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
              description={`「${progression.chords.join(" – ")}」を削除します。削除後しばらくは、通知の「元に戻す」で取り消せます。`}
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
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base tracking-wide">鍵盤ポジション</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {progression.chords.map((chord, i) => (
                <ChordKeyboard key={`${chord}-${i}`} symbol={chord} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base tracking-wide">進行の特徴</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs tracking-wider text-muted-foreground uppercase">
                フォルダ(曲)
              </p>
              <Select
                items={[
                  { value: "none", label: "未分類" },
                  ...folders.map((f) => ({ value: f.id, label: f.name })),
                ]}
                value={progression.folderId ?? "none"}
                onValueChange={(v) => {
                  void moveToFolder(progression.id, v === "none" ? null : (v as string))
                    .then((token) => toastWithUndo("フォルダを移動しました", token))
                    .catch((e: unknown) =>
                      toast.error(e instanceof Error ? e.message : "移動に失敗しました"),
                    )
                }}
              >
                <SelectTrigger aria-label="フォルダを選択">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未分類</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                  // 保存ボタンを押し忘れて画面を離れても書いた内容が消えないよう、欄から離れた時点で保存する
                  onBlur={() => {
                    if (dirty && !saving) void handleSave(true)
                  }}
                  placeholder={placeholder}
                  rows={3}
                  className="leading-relaxed"
                />
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {dirty
                  ? "入力欄から離れると自動で保存します"
                  : autoSavedAt
                    ? `${autoSavedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} に自動保存しました`
                    : ""}
              </p>
              <Button onClick={() => void handleSave()} disabled={!dirty || saving}>
                <Save data-icon="inline-start" />
                {saving ? "保存中..." : "メモを保存"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
