import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

// jsdom環境のコンポーネントテストで、render()した内容がテスト間で
// document.bodyに残り続けないようにする。node環境のロジックテストでは
// 何もrenderされていないため、cleanup()は安全に無視される。
afterEach(() => {
  cleanup()
})
