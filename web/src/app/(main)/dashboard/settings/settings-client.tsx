"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTimeZone, useTranslations } from "next-intl"
import { Clock3, Globe } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DEFAULT_TIME_ZONE,
  canonicalizeTimeZone,
  detectBrowserTimeZone,
  getSupportedTimeZones,
  normalizePersistedTimeZone,
} from "@/lib/date-time"
import { getLocaleFromPath, withLocale } from "@/lib/locale"
import { TIME_ZONE_COOKIE_NAME, type UserSettings } from "@/lib/user-settings"

const hasTimeZoneCookie = () => {
  if (typeof document === "undefined") return false
  return document.cookie.split("; ").some((entry) => entry.startsWith(`${TIME_ZONE_COOKIE_NAME}=`))
}

export default function SettingsClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTimeZone = useTimeZone()
  const normalizedCurrentTimeZone = normalizePersistedTimeZone(currentTimeZone, DEFAULT_TIME_ZONE)
  const t = useTranslations("Settings")
  const tCommon = useTranslations("Common")
  const localeOptions = [
    { value: "zh-TW", label: t("languageZhTw") },
    { value: "en", label: t("languageEn") },
    { value: "ja", label: t("languageJa") },
  ]
  const activeLocale = getLocaleFromPath(pathname)
  const [initialSettings, setInitialSettings] = useState<UserSettings>({
    locale: activeLocale,
    timeZone: normalizedCurrentTimeZone,
  })
  const [form, setForm] = useState<UserSettings>({
    locale: activeLocale,
    timeZone: normalizedCurrentTimeZone,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timeZoneOptions = useMemo(() => getSupportedTimeZones(), [])

  const buildLocalizedUrl = useCallback((nextLocale: string) => {
    const query = searchParams.toString()
    return withLocale(query ? `${pathname}?${query}` : pathname, nextLocale)
  }, [pathname, searchParams])

  useEffect(() => {
    let isActive = true

    const loadSettings = async () => {
      try {
        const response = await fetch("/api/user-settings", { cache: "no-store" })
        if (!response.ok) {
          return
        }

        const data = await response.json()
        if (!isActive || !data?.locale) {
          return
        }

        const detectedTimeZone = detectBrowserTimeZone()
        const fetchedTimeZone = normalizePersistedTimeZone(data?.timeZone, DEFAULT_TIME_ZONE)
        const resolvedTimeZone =
          !hasTimeZoneCookie() && fetchedTimeZone === DEFAULT_TIME_ZONE ? detectedTimeZone : fetchedTimeZone
        const nextSettings = {
          locale: data.locale,
          timeZone: normalizePersistedTimeZone(resolvedTimeZone, DEFAULT_TIME_ZONE),
        }

        setInitialSettings(nextSettings)
        setForm(nextSettings)

        if (data.locale !== activeLocale) {
          router.replace(buildLocalizedUrl(data.locale))
        }
      } catch {
        // Ignore sync errors for unauthenticated users.
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    loadSettings()
    return () => {
      isActive = false
    }
  }, [activeLocale, buildLocalizedUrl, router])

  const normalizedTimeZone = canonicalizeTimeZone(form.timeZone)
  const hasChanges =
    form.locale !== initialSettings.locale ||
    (normalizedTimeZone || form.timeZone.trim()) !== initialSettings.timeZone
  const isTimeZoneValid = Boolean(normalizedTimeZone)

  const handleSave = async () => {
    if (!normalizedTimeZone) {
      setError(t("timeZoneInvalid"))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/user-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale: form.locale,
          timeZone: normalizedTimeZone,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : t("saveError"))
      }

      const nextSettings = {
        locale: localeOptions.some((option) => option.value === data?.locale) ? data.locale : form.locale,
        timeZone: normalizePersistedTimeZone(data?.timeZone, normalizedTimeZone),
      }
      setInitialSettings(nextSettings)
      setForm(nextSettings)

      if (nextSettings.locale !== activeLocale) {
        window.location.assign(buildLocalizedUrl(nextSettings.locale))
        return
      }

      if (nextSettings.timeZone !== normalizedCurrentTimeZone) {
        router.refresh()
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("saveError"))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setForm(initialSettings)
    setError(null)
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10 md:px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{t("title")}</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">{t("description")}</p>
        </div>

        <Card className="border-0 bg-white shadow-xl ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="rounded-lg bg-pink-100 p-2 text-pink-600 dark:bg-pink-900/30">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{t("appearanceTitle")}</CardTitle>
              <CardDescription>{t("appearanceDescription")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2 text-base">
                  <Globe className="h-4 w-4" /> {t("language")}
                </Label>
                <p className="text-sm text-gray-500">{t("languageDescription")}</p>
              </div>
              <Select
                value={form.locale}
                onValueChange={(nextLocale) => {
                  setForm((prev) => ({ ...prev, locale: nextLocale }))
                }}
                disabled={loading || saving}
              >
                <SelectTrigger className="h-10 w-full max-w-[220px]">
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

            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="settings-time-zone" className="flex items-center gap-2 text-base">
                  <Clock3 className="h-4 w-4" /> {t("timeZone")}
                </Label>
                <p className="text-sm text-gray-500">{t("timeZoneDescription")}</p>
              </div>
              <div className="w-full max-w-[320px] space-y-2">
                <Input
                  id="settings-time-zone"
                  list="settings-time-zone-options"
                  value={form.timeZone}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, timeZone: event.target.value }))
                  }}
                  placeholder={t("timeZonePlaceholder")}
                  disabled={loading || saving}
                  className="h-10"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <datalist id="settings-time-zone-options">
                  {timeZoneOptions.map((timeZone) => (
                    <option key={timeZone} value={timeZone} />
                  ))}
                </datalist>
                {!isTimeZoneValid ? (
                  <p className="text-sm text-red-600">{t("timeZoneInvalid")}</p>
                ) : null}
              </div>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-6 dark:border-gray-800">
              <Button variant="outline" onClick={handleReset} disabled={loading || saving || !hasChanges}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleSave} disabled={loading || saving || !hasChanges || !isTimeZoneValid}>
                {saving ? tCommon("saving") : tCommon("save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
