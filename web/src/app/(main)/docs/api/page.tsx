import { headers } from "next/headers"
import { permanentRedirect } from "next/navigation"
import { defaultLocale, locales, withLocale } from "@/lib/locale"

export default async function ApiDocsRedirectPage() {
  const headerStore = await headers()
  const headerLocale = headerStore.get("x-locale")

  const locale =
    headerLocale && locales.includes(headerLocale as (typeof locales)[number])
      ? headerLocale
      : defaultLocale

  permanentRedirect(withLocale("/datasets/api", locale))
}
