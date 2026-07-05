import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-6 py-24 text-center">
      <p className="text-sm tracking-[0.3em] text-muted-foreground uppercase">404</p>
      <h1 className="text-2xl font-semibold">ページが見つかりません</h1>
      <Button variant="outline" render={<Link to="/" />}>
        Dashboardへ戻る
      </Button>
    </div>
  )
}
