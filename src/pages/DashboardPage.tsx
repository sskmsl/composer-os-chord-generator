import { Link, useNavigate } from "react-router-dom"
import { Bookmark, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SavedProgressionCard } from "@/components/saved/SavedProgressionCard"
import { useAppStore } from "@/store/useAppStore"

export function DashboardPage() {
  const navigate = useNavigate()
  const saved = useAppStore((s) => s.saved)
  const loaded = useAppStore((s) => s.loaded)
  const error = useAppStore((s) => s.error)

  const recent = saved.slice(0, 4)

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col items-start gap-6 py-6">
        <div>
          <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
            Composer OS
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-wide">Chord Generator</h1>
          <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
            Style・Key・Section・Mood を選んで、ダークで映画的なコード進行の候補を
            まとめて生成し、比較して、気に入ったものだけを残す。
          </p>
        </div>
        <Button size="lg" onClick={() => navigate("/generator")}>
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
            <CardDescription>ワークフロー</CardDescription>
            <CardTitle className="text-lg font-medium leading-relaxed">
              Style → Key → Section → 生成 → 比較 → 保存
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

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
