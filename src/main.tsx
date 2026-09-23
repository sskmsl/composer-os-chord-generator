import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import "./index.css"
import { router } from "./app/router"
import { registerSW } from "virtual:pwa-register"

// 新しい版がデプロイされていたら、起動直後にService Workerを差し替えて再読み込みする。
// 自動挿入のregisterSW.jsでは差し替え後も再読み込みされず、キャッシュ済みの古い画面が
// 次に開き直すまで表示され続けていた(ホーム画面から起動したPWAでは特に長く残る)。
registerSW({ immediate: true })

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
