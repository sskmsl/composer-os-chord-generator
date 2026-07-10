import { useEffect } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { Waves } from "lucide-react"
import { Toaster } from "@/components/ui/sonner"
import { useAppStore } from "@/store/useAppStore"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/generator", label: "Generator" },
  { to: "/saved", label: "Saved" },
]

export function AppShell() {
  const load = useAppStore((s) => s.load)
  const loaded = useAppStore((s) => s.loaded)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:justify-start sm:gap-8 sm:px-8">
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
            <Waves className="size-5 text-primary" />
            <span className="text-sm font-semibold tracking-[0.14em] whitespace-nowrap uppercase sm:text-base sm:tracking-[0.18em]">
              Composer <span className="text-primary">OS</span>
            </span>
          </NavLink>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                    isActive && "bg-accent text-accent-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <Outlet />
      </main>
      <Toaster position="bottom-right" />
    </div>
  )
}
