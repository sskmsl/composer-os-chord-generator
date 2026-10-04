import { useEffect, useRef, useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { GM_INSTRUMENT_CHOICES, SOUND_PARTS, type SoundSettings } from "@/features/audio/gmInstruments"
import { updateSoundSettings, useGmLoadState, useSoundSettings } from "@/features/audio/soundSettings"
import { cn } from "@/lib/utils"

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: string; description: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md border px-3 py-2 text-left transition-colors",
            value === option.value
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border/60 text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
        >
          <span className="block text-sm font-medium">{option.label}</span>
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{option.description}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * ヘッダーの「音色」。試聴の音(シンプル / GM音源)、コード・ベースの楽器、MIDI書き出しの形式を選ぶ。
 * 設定はこの端末に保存し、どの曲でも同じものを使う(Composer Arranger の「音色」と同じ仕様)。
 */
export function SoundSettingsMenu() {
  const settings = useSoundSettings()
  const loadState = useGmLoadState()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const usesInstruments = settings.playback === "gm" || settings.midiExport === "gm"

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onEscape)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onEscape)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground sm:px-2.5 transition-colors hover:text-foreground",
          open && "bg-accent text-accent-foreground",
        )}
        title="試聴の音色とMIDI書き出しの形式"
      >
        <SlidersHorizontal className="size-4" />
        <span className="hidden lg:inline">音色</span>
        {/* いまの試聴の音を、ボタンのまま読めるようにする(別の端末では設定が違うことがある) */}
        {loadState === "loading" ? (
          <span className="text-xs text-primary">読み込み中…</span>
        ) : settings.playback === "gm" && loadState === "failed" ? (
          <span className="text-xs text-amber-500">シンプル音で再生</span>
        ) : (
          <span className={cn("text-xs", settings.playback === "gm" ? "text-primary" : "text-muted-foreground")}>
            {settings.playback === "gm" ? "GM" : "シンプル"}
          </span>
        )}
      </button>
      {open && (
        // ヘッダーは横スクロールするため absolute だと切れる。fixed でヘッダーの直下に出す(操作履歴と同じ)
        <div
          role="dialog"
          aria-label="音色と書き出し"
          className="fixed top-16 right-2 left-2 z-50 flex max-h-[75vh] flex-col gap-4 overflow-y-auto rounded-lg border border-border/60 bg-popover p-4 shadow-xl sm:right-4 sm:left-auto sm:w-[30rem]"
        >
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">試聴の音</h2>
            <Choice<SoundSettings["playback"]>
              value={settings.playback}
              onChange={(playback) => updateSoundSettings({ playback })}
              options={[
                { value: "simple", label: "シンプル", description: "これまでのスタイルごとの合成音。すぐに鳴り、通信もしません" },
                { value: "gm", label: "GM音源", description: "ピアノやベースなどの録音した音。初回は楽器ごとに数MBを読み込みます" },
              ]}
            />
            {settings.playback === "gm" && loadState === "failed" && (
              <p className="text-xs text-amber-500">GM音源を読み込めなかったので、シンプルな音で鳴らしました。通信できる状態で、もう一度再生してください。</p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">MIDIの書き出し</h2>
            <Choice<SoundSettings["midiExport"]>
              value={settings.midiExport}
              onChange={(midiExport) => updateSoundSettings({ midiExport })}
              options={[
                { value: "logic", label: "Logic向け", description: "これまでどおり、楽器の指定なし(コード1ch・ベース2ch)。Logic Pro で音源を選んで使うとき" },
                { value: "gm", label: "GM向け", description: "コード・ベースのトラックに下の楽器番号を入れる。GM音源でそのまま鳴らすとき" },
              ]}
            />
          </section>

          <section className={cn("flex flex-col gap-2", !usesInstruments && "opacity-50")}>
            <h2 className="text-sm font-semibold">楽器</h2>
            <p className="text-xs text-muted-foreground">
              {usesInstruments ? "GM音源の試聴と、GM向けの書き出しで使います。" : "GM音源の試聴か、GM向けの書き出しを選ぶと使います。"}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SOUND_PARTS.map((part) => (
                <label key={part.id} className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span className="w-14 shrink-0">{part.label}</span>
                  <select
                    value={settings.programs[part.id]}
                    onChange={(event) => updateSoundSettings({ programs: { ...settings.programs, [part.id]: Number(event.target.value) } })}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30"
                  >
                    {GM_INSTRUMENT_CHOICES.map((choice) => (
                      <option key={choice.program} value={choice.program}>{choice.label}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <p className="text-xs leading-5 text-muted-foreground">
            GM音源: FluidR3_GM(Frank Wen)を MIDI.js 用に書き出したもの(
            <a className="underline" href="https://github.com/gleitz/midi-js-soundfonts" target="_blank" rel="noreferrer">gleitz/midi-js-soundfonts</a>
            、CC BY 3.0)。設定はこの端末に保存し、どの曲でも同じものを使います。
          </p>
        </div>
      )}
    </div>
  )
}
