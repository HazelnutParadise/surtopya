"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Globe } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

export default function SettingsClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations("Settings")
  const localeOptions = [
    { value: "zh-TW", label: t("languageZhTw") },
    { value: "en", label: t("languageEn") },
    { value: "ja", label: t("languageJa") },
  ]
  const activeLocale = (() => {
    const segment = pathname.split("/").filter(Boolean)[0]
    return localeOptions.some((option) => option.value === segment) ? segment : "zh-TW"
  })()
  const [selectedLocale, setSelectedLocale] = useState(activeLocale)
  const [loadingLocale, setLoadingLocale] = useState(true)

  const handleLocaleChange = (nextLocale: string, refresh = false) => {
    const segments = pathname.split("/").filter(Boolean)
    const hasLocale = localeOptions.some((option) => option.value === segments[0])
    const rest = hasLocale ? segments.slice(1) : segments
    const nextPath = `/${nextLocale}/${rest.join("/")}`.replace(/\/$/, "")
    const query = searchParams.toString()
    const nextUrl = query ? `${nextPath}?${query}` : nextPath
    if (refresh) {
      window.location.assign(nextUrl)
      return
    }
    router.push(nextUrl)
  }

  useEffect(() => {
    let isActive = true
    const loadLocale = async () => {
      try {
        const response = await fetch("/api/user-settings", { cache: "no-store" })
        if (!response.ok) {
          return
        }
        const data = await response.json()
        if (!isActive || !data?.locale) {
          return
        }
        setSelectedLocale(data.locale)
        if (data.locale !== activeLocale) {
          handleLocaleChange(data.locale)
        }
      } catch {
        // Ignore locale sync errors for unauthenticated users
      } finally {
        if (isActive) {
          setLoadingLocale(false)
        }
      }
    }

    loadLocale()
    return () => {
      isActive = false
    }
  }, [])

  const saveLocalePreference = async (nextLocale: string) => {
    try {
      await fetch("/api/user-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locale: nextLocale }),
      })
    } catch {
      // Ignore persistence errors for unauthenticated users
    }
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{t("title")}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t("description")}</p>
        </div>

        <Card className="border-0 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30 text-pink-600">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{t("appearanceTitle")}</CardTitle>
              <CardDescription>{t("appearanceDescription")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" /> {t("language")}
                </Label>
                <p className="text-sm text-gray-500">{t("languageDescription")}</p>
              </div>
              <Select
                value={selectedLocale}
                onValueChange={async (nextLocale) => {
                  setSelectedLocale(nextLocale)
                  await saveLocalePreference(nextLocale)
                  handleLocaleChange(nextLocale, true)
                }}
                disabled={loadingLocale}
              >
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {localeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
