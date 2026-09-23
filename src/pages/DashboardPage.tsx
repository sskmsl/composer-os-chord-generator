import { useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Bookmark, Music, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SavedProgressionCard } from "@/components/saved/SavedProgressionCard"
import { songBarCount, songSections } from "@/features/midi/exportSong"
import { useAppStore } from "@/store/useAppStore"
import { SECTION_ROLE_LABELS } from "@/types/music"
import { lastModifiedAt } from "@/types/progression"
import { formatDate } from "@/utils/date"

/** ダッシュボードに出す最近の曲の数 */
const RECENT_SONG_COUNT = 4

export function DashboardPage() {
  const navigate = useNavigate()
  const saved = useAppStore((s) => s.saved)
  const folders = useAppStore((s) => s.folders)
  const loaded = useAppStore((s) => s.loaded)
  const error = useAppStore((s) => s.error)

  const recent = saved.slice(0, 4)

  // 曲(フォルダ)の新しさは、フォルダ自体の更新と中のセクションの保存・編集のうち最も新しいもの
  const recentSongs = useMemo(
    () =>
      folders
        .map((folder) => {
          const sections = songSections(folder, saved)
          const touchedAt = sections.reduce(
            (latest, s) => (lastModifiedAt(s) > latest ? lastModifiedAt(s) : latest),
            folder.updatedAt,
          )
          return { folder, sections, touchedAt }
        })
        .filter((song) => song.sections.length > 0)
        .sort((a, b) => b.touchedAt.localeCompare(a.touchedAt))
        .slice(0, RECENT_SONG_COUNT),
    [folders, saved],
  )

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col items-start gap-4 py-6">
        <h1 className="text-4xl font-semibold tracking-wide">Chord Generator</h1>
        <p className="text-sm text-muted-foreground">Style → Key → Section → 生成 → 比較 → 保存 → 曲の構成</p>
        <Button className="h-11 px-6 text-base" onClick={() => navigate("/generator")}>
          <Sparkles data-icon="inline-start" />
          進行を生成する
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="text-sm text-destructive">
            データの読み込みに失敗しました: {error}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardDescription>保存済みの進行</CardDescription>
            <CardTitle className="flex items-baseline gap-2 text-4xl font-semibold">
              {loaded ? saved.length : "–"}
              <span className="text-sm font-normal text-muted-foreground">progressions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" render={<Link to="/saved" />}>
              <Bookmark data-icon="inline-start" />
              保存済み一覧へ
            </Button>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader>
            <CardDescription>曲(フォルダ)</CardDescription>
            <CardTitle className="flex items-baseline gap-2 text-4xl font-semibold">
              {loaded ? folders.length : "–"}
              <span className="text-sm font-normal text-muted-foreground">songs</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            フォルダにまとめた進行は、曲の構成として試聴・MIDI書き出しができます。
          </CardContent>
        </Card>
      </div>

      {recentSongs.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium tracking-wide">最近の曲</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {recentSongs.map(({ folder, sections, touchedAt }) => (
              <Link
                key={folder.id}
                to={`/saved?folder=${encodeURIComponent(folder.id)}`}
                className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <Music className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(touchedAt)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {sections.map((s) => (
                    <Badge key={s.id} variant="secondary" className="font-normal">
                      {SECTION_ROLE_LABELS[s.section] ?? s.section}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {sections.length}セクション / 約{songBarCount(sections)}小節
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium tracking-wide">最近保存した進行</h2>
          {saved.length > 0 && (
            <Link to="/saved" className="text-sm text-primary hover:underline">
              すべて見る
            </Link>
          )}
        </div>
        {loaded && saved.length === 0 ? (
          <Card className="border-dashed border-border/60">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="text-muted-foreground">
                まだ保存された進行がありません。まずは生成してみましょう。
              </p>
              <Button onClick={() => navigate("/generator")}>
                <Sparkles data-icon="inline-start" />
                Generatorを開く
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((p) => (
              <SavedProgressionCard key={p.id} progression={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
