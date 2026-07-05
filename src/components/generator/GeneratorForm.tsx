import { Sparkles, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { STYLE_OPTIONS } from "@/features/chord-engine/templates"
import { useAppStore } from "@/store/useAppStore"
import {
  MAJOR_KEYS,
  MINOR_KEYS,
  MOOD_OPTIONS,
  SECTION_OPTIONS,
  VARIATION_OPTIONS,
  keyId,
  keyLabel,
  type MoodId,
  type SectionId,
  type StyleId,
  type VariationCount,
} from "@/types/music"

const ALL_KEYS = [...MINOR_KEYS, ...MAJOR_KEYS]

const KEY_ITEMS = ALL_KEYS.map((k) => ({ value: keyId(k), label: keyLabel(k) }))
const STYLE_ITEMS = STYLE_OPTIONS.map((s) => ({ value: s.value, label: s.label }))
const COUNT_ITEMS = VARIATION_OPTIONS.map((c) => ({ value: String(c), label: `${c}件` }))

export function GeneratorForm() {
  const params = useAppStore((s) => s.params)
  const setParams = useAppStore((s) => s.setParams)
  const generate = useAppStore((s) => s.generate)
  const restorePrevious = useAppStore((s) => s.restorePrevious)
  const previousResults = useAppStore((s) => s.previousResults)

  const currentStyle = STYLE_OPTIONS.find((s) => s.value === params.style)

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/50 p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="Style">
          <Select
            items={STYLE_ITEMS}
            value={params.style}
            onValueChange={(v) => setParams({ style: v as StyleId })}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STYLE_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Key">
          <Select
            items={KEY_ITEMS}
            value={keyId(params.key)}
            onValueChange={(v) => {
              const key = ALL_KEYS.find((k) => keyId(k) === v)
              if (key) setParams({ key })
            }}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Minor</SelectLabel>
                {MINOR_KEYS.map((k) => (
                  <SelectItem key={keyId(k)} value={keyId(k)}>{keyLabel(k)}</SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Major</SelectLabel>
                {MAJOR_KEYS.map((k) => (
                  <SelectItem key={keyId(k)} value={keyId(k)}>{keyLabel(k)}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Section">
          <Select
            items={SECTION_OPTIONS}
            value={params.section}
            onValueChange={(v) => setParams({ section: v as SectionId })}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SECTION_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Mood">
          <Select
            items={MOOD_OPTIONS}
            value={params.mood}
            onValueChange={(v) => setParams({ mood: v as MoodId })}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOOD_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="生成数">
          <Select
            items={COUNT_ITEMS}
            value={String(params.count)}
            onValueChange={(v) => setParams({ count: Number(v) as VariationCount })}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNT_ITEMS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {currentStyle ? `${currentStyle.label} — ${currentStyle.tagline}` : ""}
        </p>
        <div className="flex items-center gap-2">
          {previousResults && (
            <Button variant="outline" onClick={restorePrevious}>
              <Undo2 data-icon="inline-start" />
              前の結果に戻る
            </Button>
          )}
          <Button size="lg" onClick={generate}>
            <Sparkles data-icon="inline-start" />
            生成する
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs tracking-wider text-muted-foreground uppercase">{label}</Label>
      {children}
    </div>
  )
}
