import { createBrowserRouter } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { DashboardPage } from "@/pages/DashboardPage"
import { GeneratorPage } from "@/pages/GeneratorPage"
import { SavedProgressionsPage } from "@/pages/SavedProgressionsPage"
import { ProgressionDetailPage } from "@/pages/ProgressionDetailPage"
import { NotFoundPage } from "@/pages/NotFoundPage"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "generator", element: <GeneratorPage /> },
      { path: "saved", element: <SavedProgressionsPage /> },
      { path: "saved/:id", element: <ProgressionDetailPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])
