import { FolderPlus } from "lucide-react"
import { toast } from "sonner"
import { GeneratorForm } from "@/components/generator/GeneratorForm"
import { NextSectionSuggestion } from "@/components/generator/NextSectionSuggestion"
import { ProgressionResultCard } from "@/components/generator/ProgressionResultCard"
import { FolderNameDialog } from "@/components/saved/FolderNameDialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAppStore } from "@/store/useAppStore"
import type { GeneratedProgression } from "@/types/progression"

export function GeneratorPage() {
  const results = useAppStore((s) => s.results)
  const params = useAppStore((s) => s.params)
  const saved = useAppStore((s) => s.saved)
  const saveProgression = useAppStore((s) => s.saveProgression)
  const folders = useAppStore((s) => s.folders)
  const saveTargetFolderId = useAppStore((s) => s.saveTargetFolderId)
  const setSaveTargetFolder = useAppStore((s) => s.setSaveTargetFolder)
  const createFolder = useAppStore((s) => s.createFolder)

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {results.length}件の候補
              {results.length < params.count &&
                `(重複を除いたユニークな進行は${results.length}件でした)`}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs tracking-wider text-muted-foreground uppercase">
                保存先
              </span>
              <Select
                items={[
                  { value: "none", label: "未分類" },
                  ...folders.map((f) => ({ value: f.id, label: f.name })),
                ]}
                value={saveTargetFolderId ?? "none"}
                onValueChange={(v) => setSaveTargetFolder(v === "none" ? null : (v as string))}
              >
                <SelectTrigger size="sm" aria-label="保存先フォルダ">
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
              <FolderNameDialog
                title="新しいフォルダ(曲)"
                description="この曲の進行をまとめるフォルダを作成します。"
                submitLabel="作成する"
                onSubmit={async (name) => {
                  const folder = await createFolder(name)
                  setSaveTargetFolder(folder.id)
                  toast.success(`フォルダ「${folder.name}」を作成しました`)
                }}
                trigger={
                  <Button variant="outline" size="icon-sm" aria-label="フォルダを作成">
                    <FolderPlus />
                  </Button>
                }
              />
            </div>
          </div>
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
          <NextSectionSuggestion />
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
