"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bell, Shield, Palette, Globe, Trash2, AlertTriangle } from "lucide-react"
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

  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    surveys: true,
    marketing: false,
  })

  const handleLocaleChange = (nextLocale: string) => {
    const segments = pathname.split("/").filter(Boolean)
    const hasLocale = localeOptions.some((option) => option.value === segments[0])
    const rest = hasLocale ? segments.slice(1) : segments
    const nextPath = `/${nextLocale}/${rest.join("/")}`.replace(/\/$/, "")
    const query = searchParams.toString()
    router.push(query ? `${nextPath}?${query}` : nextPath)
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
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t("description")}
          </p>
        </div>

        <div className="space-y-6">
          {/* Notifications */}
          <Card className="border-0 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{t("notificationsTitle")}</CardTitle>
                <CardDescription>{t("notificationsDescription")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t("emailNotifications")}</Label>
                  <p className="text-sm text-gray-500">{t("emailNotificationsDescription")}</p>
                </div>
                <Switch checked={notifications.email} onCheckedChange={(val) => setNotifications({ ...notifications, email: val })} />
              </div>
              <Separator className="dark:bg-gray-800" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t("surveyInvitations")}</Label>
                  <p className="text-sm text-gray-500">{t("surveyInvitationsDescription")}</p>
                </div>
                <Switch checked={notifications.surveys} onCheckedChange={(val) => setNotifications({ ...notifications, surveys: val })} />
              </div>
              <Separator className="dark:bg-gray-800" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t("marketingUpdates")}</Label>
                  <p className="text-sm text-gray-500">{t("marketingUpdatesDescription")}</p>
                </div>
                <Switch checked={notifications.marketing} onCheckedChange={(val) => setNotifications({ ...notifications, marketing: val })} />
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card className="border-0 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{t("privacyTitle")}</CardTitle>
                <CardDescription>{t("privacyDescription")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t("publicProfile")}</Label>
                  <p className="text-sm text-gray-500">{t("publicProfileDescription")}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="dark:bg-gray-800" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t("dataSharing")}</Label>
                  <p className="text-sm text-gray-500">{t("dataSharingDescription")}</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Appearance & Language */}
          <Card className="border-0 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30 text-pink-600">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{t("appearanceTitle")}</CardTitle>
                <CardDescription>{t("appearanceDescription")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t("darkMode")}</Label>
                  <p className="text-sm text-gray-500">{t("darkModeDescription")}</p>
                </div>
                <Switch />
              </div>
              <Separator className="dark:bg-gray-800" />
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
                    handleLocaleChange(nextLocale)
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

          {/* Danger Zone */}
          <Card className="border-2 border-red-100 dark:border-red-900/30 shadow-none bg-red-50/50 dark:bg-red-950/10">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
            <CardTitle className="text-lg">{t("dangerZone")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="font-semibold text-gray-900 dark:text-white">{t("deleteAccount")}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t("deleteAccountDescription")}</p>
                </div>
                <Button variant="destructive" className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" /> {t("deleteAccount")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
