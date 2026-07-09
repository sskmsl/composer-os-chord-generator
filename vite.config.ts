import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

// https://vite.dev/config/
export default defineConfig({
  base: "./", // file://で配信するElectronパッケージ、サブパス配信のどちらでも動くよう相対パスにする
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Composer OS Chord Generator",
        short_name: "Chord Gen",
        description:
          "ダークで映画的なコード進行を生成・保存し、MIDI書き出しできる作曲支援ツール",
        // baseが相対パスのため、start_url/scopeもドメイン直下前提にしない
        start_url: ".",
        scope: "./",
        display: "standalone",
        orientation: "any",
        theme_color: "#1a1420",
        background_color: "#1a1420",
        icons: [
          { src: "pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
