const { app, BrowserWindow, shell, session, nativeImage } = require("electron")
const path = require("node:path")

const DEV_SERVER_URL = process.env.ELECTRON_DEV_SERVER_URL
const ICON_PATH = path.join(__dirname, "..", "build", "icon.icns")

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#1a1420", // ダークテーマの背景色に合わせ、起動時の白画面を防ぐ
    title: "Composer OS Chord Generator",
    icon: ICON_PATH,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // 外部リンクはOSのデフォルトブラウザで開く(アプリ内ナビゲーションを防ぐ)
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: "deny" }
  })

  win.webContents.on("did-fail-load", (_e, code, description, url) => {
    console.error("[composer-os] failed to load", url, code, description)
  })

  if (DEV_SERVER_URL) {
    void win.loadURL(DEV_SERVER_URL)
  } else {
    void win.loadFile(path.join(__dirname, "..", "dist", "index.html"))
  }
}

app.whenReady().then(() => {
  // 開発時(未パッケージ)はDockアイコンが既定のElectronロゴになるため明示的に設定する。
  // パッケージ後はInfo.plistのCFBundleIconFile(electron-builderが設定)が使われる
  if (!app.isPackaged && process.platform === "darwin") {
    app.dock?.setIcon(nativeImage.createFromPath(ICON_PATH))
  }

  // MIDI書き出し(Blob URL経由のダウンロード)を既定のダウンロードフォルダへ保存する
  session.defaultSession.on("will-download", (_e, item) => {
    item.setSavePath(path.join(app.getPath("downloads"), item.getFilename()))
  })

  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
