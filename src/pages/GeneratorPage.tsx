import { toast } from "sonner"
import { GeneratorForm } from "@/components/generator/GeneratorForm"
import { ProgressionResultCard } from "@/components/generator/ProgressionResultCard"
import { useAppStore } from "@/store/useAppStore"
import type { GeneratedProgression } from "@/types/progression"

export function GeneratorPage() {
  const results = useAppStore((s) => s.results)
  const params = useAppStore((s) => s.params)
  const saved = useAppStore((s) => s.saved)
  const saveProgression = useAppStore((s) => s.saveProgression)

  const savedIds = new Set(saved.map((p) => p.id))

  const handleSave = async (progression: GeneratedProgression) => {
    try {
      await saveProgression(progression)
      toast.success("進行を保存しました")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">Generator</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-wide">Chord Generator</h1>
      </div>

      <GeneratorForm />

      {results.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            {results.length}件の候補
            {results.length < params.count &&
              `(重複を除いたユニークな進行は${results.length}件でした)`}
          </p>
          <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p) => (
              <ProgressionResultCard
                key={p.id}
                progression={p}
                saved={savedIds.has(p.id)}
                onSave={() => void handleSave(p)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 py-20 text-center">
          <p className="text-muted-foreground">
            条件を選んで「生成する」を押すと、コード進行の候補が表示されます。
          </p>
        </div>
      )}
    </div>
  )
}
