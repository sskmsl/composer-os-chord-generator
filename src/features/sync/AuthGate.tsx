import { useEffect, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Waves } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { syncPullAndReconcile } from "@/features/sync/supabaseSync"
import { useAppStore } from "@/store/useAppStore"

/**
 * Supabase未接続(環境変数なし)ならそのままchildrenを表示(ローカルのみで動作)。
 * 接続時はログイン必須にし、ログイン直後にリモートとローカルを同期する。
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session) return
    setSyncing(true)
    syncPullAndReconcile()
      .then(() => useAppStore.getState().load())
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "同期に失敗しました"))
      .finally(() => setSyncing(false))
  }, [session])

  if (!supabase) return <>{children}</>
  if (session === undefined) return null
  if (!session) return <LoginForm />
  if (syncing) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">同期中...</p>
      </div>
    )
  }
  return <>{children}</>
}

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) toast.error(error.message)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={(e) => void handleSubmit(e)} className="flex w-full max-w-xs flex-col gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <Waves className="size-6 text-primary" />
          <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">Composer OS</p>
          <h1 className="text-xl font-semibold tracking-wide">ログイン</h1>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-email">メールアドレス</Label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-password">パスワード</Label>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "ログイン中..." : "ログイン"}
        </Button>
      </form>
    </div>
  )
}
