import { Suspense } from "react"
import SettingsClient from "./settings-client"

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-10 px-4 md:px-6 max-w-4xl">Loading settings...</div>}>
      <SettingsClient />
    </Suspense>
  )
}
