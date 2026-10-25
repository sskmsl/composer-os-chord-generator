/**
 * GM音源(MIDI.js Soundfonts の FluidR3_GM)のサンプルを読み込み、Web Audio で鳴らす。
 * 楽器ごとのファイル(音名ごとの mp3 を base64 で並べた JS)は1回だけ取得し、
 * 使う音だけを復号して、このページを開いている間は使い回す(AudioBuffer は AudioContext をまたいで使える)。
 *
 * 音源: FluidR3_GM(Frank Wen)を MIDI.js 用に書き出したもの(https://github.com/gleitz/midi-js-soundfonts、CC BY 3.0)。
 */
export const GM_SOUNDFONT_BASE_URL = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/"

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
/** FluidR3_GM に入っている音域(A0〜C8)。外の音は端の音の再生速度を変えて鳴らす */
const LOWEST = 21
const HIGHEST = 108

export function gmNoteName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

/** サンプルの音(音域の中に丸めた音)と、再生速度(音域の外なら半音ずつずらす) */
export function gmSampleFor(midi: number): { sampleMidi: number; playbackRate: number } {
  const sampleMidi = Math.max(LOWEST, Math.min(HIGHEST, Math.round(midi)))
  return { sampleMidi, playbackRate: Math.pow(2, (midi - sampleMidi) / 12) }
}

/** 楽器ファイル(JS)から、音名 → data URL の表を取り出す */
export function parseSoundfontScript(text: string): Map<string, string> {
  const notes = new Map<string, string>()
  const pattern = /"([A-G]b?-?\d)"\s*:\s*"(data:audio\/[a-z0-9]+;base64,[^"]+)"/g
  for (const match of text.matchAll(pattern)) notes.set(match[1], match[2])
  return notes
}

const fileCache = new Map<string, Promise<Map<string, string>>>()
const bufferCache = new Map<string, Promise<AudioBuffer>>()
let decoder: BaseAudioContext | null = null

function decodingContext(): BaseAudioContext {
  decoder ??= new OfflineAudioContext(1, 1, 44_100)
  return decoder
}

function loadFile(file: string): Promise<Map<string, string>> {
  let pending = fileCache.get(file)
  if (!pending) {
    pending = fetch(`${GM_SOUNDFONT_BASE_URL}${file}-mp3.js`)
      .then((response) => {
        if (!response.ok) throw new Error(`GM音源を読み込めません(${response.status})`)
        return response.text()
      })
      .then(parseSoundfontScript)
    // 失敗したときは次の再生でもう一度取りに行く
    pending.catch(() => fileCache.delete(file))
    fileCache.set(file, pending)
  }
  return pending
}

function base64ToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

function loadBuffer(file: string, sampleMidi: number): Promise<AudioBuffer> {
  const key = `${file}:${sampleMidi}`
  let pending = bufferCache.get(key)
  if (!pending) {
    pending = loadFile(file).then((notes) => {
      const dataUrl = notes.get(gmNoteName(sampleMidi))
      if (!dataUrl) throw new Error(`GM音源に ${gmNoteName(sampleMidi)} がありません`)
      return decodingContext().decodeAudioData(base64ToArrayBuffer(dataUrl))
    })
    pending.catch(() => bufferCache.delete(key))
    bufferCache.set(key, pending)
  }
  return pending
}

export type GmBufferKey = `${string}:${number}`

export const gmBufferKey = (file: string, sampleMidi: number): GmBufferKey => `${file}:${sampleMidi}`

/** 楽器ファイルごとの必要な音を読み込み、`楽器:音` → AudioBuffer の表を返す */
export async function loadGmBuffers(requests: ReadonlyMap<string, ReadonlySet<number>>): Promise<Map<GmBufferKey, AudioBuffer>> {
  const entries = await Promise.all(
    [...requests].flatMap(([file, pitches]) => {
      const samples = new Set([...pitches].map((pitch) => gmSampleFor(pitch).sampleMidi))
      return [...samples].map(async (sampleMidi) => [gmBufferKey(file, sampleMidi), await loadBuffer(file, sampleMidi)] as const)
    }),
  )
  return new Map(entries)
}

/** 先頭の無音とみなす振幅(約 -54dB)。mp3 の符号化で付く頭の遅れを見つけるのに使う */
const SILENCE_THRESHOLD = 0.002
/** 先頭の無音として切り詰める長さの上限(秒)。これより長い無音は音の一部とみなして残す */
const MAX_LEADING_SILENCE = 0.15
/** 末尾が持続音とみなせる、最大の音量(窓ごとの実効値)に対する比 */
const SUSTAINED_TAIL_RATIO = 0.3
/** 末尾を調べる窓(秒)。サンプル終端の手前 0.5〜0.1 秒。終端の淡い消え方を避けるため終端そのものは見ない。繰り返す区間もこの中から選ぶ */
const TAIL_WINDOW = { from: 0.5, to: 0.1 }
/** 繰り返す区間の最短の長さ(秒)。短すぎると繰り返しが震えて聞こえる */
const MIN_LOOP = 0.12
/** つなぎ目の候補(上向きのゼロ交差)の数の上限。組み合わせを調べる時間を抑える */
const MAX_LOOP_CANDIDATES = 400
const RMS_WINDOW = 0.05

export interface SampleShape {
  /** 再生を始める位置(秒)。先頭の無音を飛ばす */
  start: number
  /** 音が持続したままサンプルが終わるとき、繰り返す区間(秒)。減衰して終わるサンプルは null */
  loop: { start: number; end: number } | null
}

const shapeCache = new WeakMap<AudioBuffer, SampleShape>()

/**
 * 繰り返しのつなぎ目で波形が飛ばない区間を選ぶ。始点と終点を上向きのゼロ交差に限り、
 * そのうち「終点の値と始点の値の差」と「傾きの差」が最小の組を取る。固定の位置で繰り返すと、
 * 音の高さによっては波形がずれてつなぎ目ごとにクリック音(ブツブツ)が出る。見つからなければ null。
 */
function findSeamlessLoop(data: Float32Array, rate: number, from: number, to: number): { start: number; end: number } | null {
  const crossings: number[] = []
  for (let index = Math.max(1, from); index < to; index += 1) {
    if (data[index - 1] < 0 && data[index] >= 0) crossings.push(index)
  }
  const stride = Math.ceil(crossings.length / MAX_LOOP_CANDIDATES)
  const candidates = stride > 1 ? crossings.filter((_, i) => i % stride === 0) : crossings
  const minLength = Math.floor(MIN_LOOP * rate)

  let best: { start: number; end: number } | null = null
  let bestCost = Infinity
  for (const start of candidates) {
    for (const end of candidates) {
      if (end - start < minLength) continue
      const jump = Math.abs(data[end] - data[start])
      const slope = Math.abs(data[end] - data[end - 1] - (data[start] - data[start - 1]))
      const cost = jump + slope
      if (cost < bestCost) {
        bestCost = cost
        best = { start, end }
      }
    }
  }
  return best ? { start: best.start / rate, end: best.end / rate } : null
}

function rms(data: Float32Array, from: number, to: number): number {
  const a = Math.max(0, Math.min(data.length, from))
  const b = Math.max(a, Math.min(data.length, to))
  if (b === a) return 0
  let sum = 0
  for (let index = a; index < b; index += 1) sum += data[index] * data[index]
  return Math.sqrt(sum / (b - a))
}

/**
 * サンプルの形を調べる。
 *  - 先頭の無音: mp3 で書き出したサンプルは頭に無音が付くことがあり、そのまま鳴らすと
 *    コードの切り替わりで新しい和音の発音が遅れて、前の和音が減衰したあとに音の谷ができる
 *  - 持続したまま終わるサンプル: パッドや弦などで、サンプルがコードより短いと途中で音が途切れる。
 *    終端が最大の音量に近いときだけ持続音とみなし、終端近くのつなぎ目がなめらかな区間を繰り返して音価の終わりまで保つ。
 *    ピアノのように自然に減衰して終わるサンプルは、そのまま鳴らす
 */
export function analyzeSample(buffer: AudioBuffer): SampleShape {
  const cached = shapeCache.get(buffer)
  if (cached) return cached

  const data = buffer.getChannelData(0)
  const rate = buffer.sampleRate
  const limit = Math.min(data.length, Math.floor(MAX_LEADING_SILENCE * rate))
  let first = 0
  while (first < limit && Math.abs(data[first]) < SILENCE_THRESHOLD) first += 1
  const start = first >= limit ? 0 : first / rate

  let loop: SampleShape["loop"] = null
  const window = Math.floor(RMS_WINDOW * rate)
  let peak = 0
  for (let at = 0; at + window <= data.length; at += window) peak = Math.max(peak, rms(data, at, at + window))
  const tailFrom = data.length - Math.floor(TAIL_WINDOW.from * rate)
  const tailTo = data.length - Math.floor(TAIL_WINDOW.to * rate)
  if (peak > 0 && tailFrom > first && rms(data, tailFrom, tailTo) >= peak * SUSTAINED_TAIL_RATIO) {
    loop = findSeamlessLoop(data, rate, tailFrom, tailTo)
  }

  const shape = { start, loop }
  shapeCache.set(buffer, shape)
  return shape
}

/**
 * サンプルを1音鳴らす。音価の終わりで短く減衰させる(持続する楽器も、減衰する楽器も同じ扱い)。
 * 先頭の無音は飛ばし、持続したまま終わるサンプルは音価の終わりまで繰り返す(analyzeSample)。
 * 返り値は音が鳴り終わる時刻。
 */
export function scheduleGmSample(
  ctx: BaseAudioContext,
  destination: AudioNode,
  buffer: AudioBuffer,
  pitch: number,
  velocity: number,
  t0: number,
  duration: number,
  release = 0.25,
): number {
  const { playbackRate } = gmSampleFor(pitch)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = playbackRate
  const shape = analyzeSample(buffer)
  if (shape.loop) {
    source.loop = true
    source.loopStart = shape.loop.start
    source.loopEnd = shape.loop.end
  }
  const gain = ctx.createGain()
  const level = 0.9 * Math.pow(Math.max(0.1, Math.min(1, velocity / 127)), 1.4)
  const end = t0 + Math.max(0.05, duration)
  gain.gain.setValueAtTime(level, t0)
  gain.gain.setValueAtTime(level, end)
  gain.gain.exponentialRampToValueAtTime(0.0001, end + release)
  source.connect(gain)
  gain.connect(destination)
  source.start(t0, shape.start)
  source.stop(end + release + 0.02)
  return end + release
}
