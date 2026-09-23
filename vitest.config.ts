import path from "path"
import { defineConfig } from "vitest/config"

// vite.config.ts とは別に、ロジック層(chord-engine等)だけを高速に検証するための
// 最小構成。React/PWAプラグインは不要なので含めない。
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
  },
})
