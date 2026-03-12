"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTimeZone } from "next-intl"
import { detectBrowserLocale, getLocaleFromPath, matchSupportedLocale, withLocale } from "@/lib/locale"
import { DEFAULT_TIME_ZONE, canonicalizeTimeZone, detectBrowserTimeZone, normalizePersistedTimeZone } from "@/lib/date-time"
import {
  determineAutoDetectedSettingsPatch,
  LOCALE_COOKIE_NAME,
  TIME_ZONE_COOKIE_NAME,
  type UserSettingsResponse,
} from "@/lib/user-settings"

const readClientCookie = (name: string) => {
  if (typeof document === "undefined") return null
  const prefix = `${name}=`
  const entry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix))

  if (!entry) return null

  try {
    return decodeURIComponent(entry.slice(prefix.length))
  } catch {
    return entry.slice(prefix.length)
  }
}

export function LocaleSync() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTimeZone = useTimeZone()

  useEffect(() => {
    let isActive = true

    const syncSettings = async () => {
      try {
        const initialCookieLocale = matchSupportedLocale(readClientCookie(LOCALE_COOKIE_NAME))
        const rawInitialCookieTimeZone = readClientCookie(TIME_ZONE_COOKIE_NAME)
        const initialCookieTimeZone = canonicalizeTimeZone(rawInitialCookieTimeZone)
        const detectedLocale = detectBrowserLocale()
        const detectedTimeZone = detectBrowserTimeZone()

        const response = await fetch("/api/user-settings", { cache: "no-store" })
        if (!response.ok) {
          return
        }

        let data: UserSettingsResponse = await response.json()
        if (!isActive || !data?.locale) {
          return
        }

        const currentSettings: UserSettingsResponse = {
          locale: matchSupportedLocale(data?.locale) || getLocaleFromPath(pathname),
          timeZone: normalizePersistedTimeZone(data?.timeZone, DEFAULT_TIME_ZONE),
          settingsAutoInitialized: Boolean(data?.settingsAutoInitialized),
        }
        const autoDetectedPatch = determineAutoDetectedSettingsPatch({
          currentSettings,
          initialCookieLocale,
          initialCookieTimeZone,
          detectedLocale,
          detectedTimeZone,
        })

        if (autoDetectedPatch) {
          const patchResponse = await fetch("/api/user-settings", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(autoDetectedPatch),
          })

          if (patchResponse.ok) {
            data = await patchResponse.json()
          }
        }

        const currentLocale = getLocaleFromPath(pathname)
        if (data.locale !== currentLocale) {
          const query = searchParams.toString()
          const nextPath = withLocale(query ? `${pathname}?${query}` : pathname, data.locale)
          router.replace(nextPath)
          return
        }

        const nextTimeZone = normalizePersistedTimeZone(data?.timeZone, DEFAULT_TIME_ZONE)
        if (nextTimeZone !== normalizePersistedTimeZone(currentTimeZone, DEFAULT_TIME_ZONE)) {
          router.refresh()
        }
      } catch {
        // Ignore sync errors for unauthenticated users.
      }
    }

    syncSettings()
    return () => {
      isActive = false
    }
  }, [currentTimeZone, pathname, router, searchParams])

  return null
}
