import { Suspense } from "react"
import SettingsClient from "./settings-client"
import { getServerTranslator } from "@/lib/i18n-server"

export default async function SettingsPage() {
  const tCommon = await getServerTranslator("Common")
  return (
    <Suspense fallback={<div className="container mx-auto py-10 px-4 md:px-6 max-w-4xl">{tCommon("loading")}</div>}>
      <SettingsClient />
    </Suspense>
  )
}
