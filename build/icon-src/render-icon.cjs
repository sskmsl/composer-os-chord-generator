// アイコン制作用の一時スクリプト。HTML/SVGをElectronでレンダリングしPNGへ書き出す。
// 使い方: electron build/icon-src/render-icon.cjs
const { app, BrowserWindow } = require("electron")
const path = require("node:path")
const fs = require("node:fs")

const OUT_DIR = path.join(__dirname, "..", "icon.iconset")
const MASTER_PNG = path.join(__dirname, "..", "icon-1024.png")
// PWA用アイコンはpublic/直下に置き、ビルド成果物としてそのまま配信する
const PWA_DIR = path.join(__dirname, "..", "..", "public", "pwa")

const SIZES = [
  { name: "icon_16x16.png", size: 16 },
  { name: "icon_16x16@2x.png", size: 32 },
  { name: "icon_32x32.png", size: 32 },
  { name: "icon_32x32@2x.png", size: 64 },
  { name: "icon_128x128.png", size: 128 },
  { name: "icon_128x128@2x.png", size: 256 },
  { name: "icon_256x256.png", size: 256 },
  { name: "icon_256x256@2x.png", size: 512 },
  { name: "icon_512x512.png", size: 512 },
  { name: "icon_512x512@2x.png", size: 1024 },
]

const PWA_SIZES = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
]

app.whenReady().then(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.mkdirSync(PWA_DIR, { recursive: true })

  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: { offscreen: false },
  })

  await win.loadFile(path.join(__dirname, "icon.html"))
  // フォント・グラデーションのレンダリング完了を確実に待つ
  await new Promise((r) => setTimeout(r, 200))

  const image = await win.webContents.capturePage()
  fs.writeFileSync(MASTER_PNG, image.toPNG())

  for (const { name, size } of SIZES) {
    const resized = image.resize({ width: size, height: size, quality: "best" })
    fs.writeFileSync(path.join(OUT_DIR, name), resized.toPNG())
  }

  for (const { name, size } of PWA_SIZES) {
    const resized = image.resize({ width: size, height: size, quality: "best" })
    fs.writeFileSync(path.join(PWA_DIR, name), resized.toPNG())
  }

  console.log("[icon] done:", OUT_DIR, PWA_DIR)
  app.quit()
})
