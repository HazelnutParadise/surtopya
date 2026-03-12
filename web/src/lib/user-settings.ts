export const LOCALE_COOKIE_NAME = "NEXT_LOCALE"
export const TIME_ZONE_COOKIE_NAME = "SURTOPYA_TIMEZONE"

export type UserSettings = {
  locale: string
  timeZone: string
}

export type UserSettingsResponse = UserSettings & {
  settingsAutoInitialized: boolean
}

export type AutoDetectedSettingsPatch = UserSettings & {
  autoInitialize: true
}

type AutoDetectSettingsInput = {
  currentSettings: UserSettingsResponse
  initialCookieLocale?: string | null
  initialCookieTimeZone?: string | null
  detectedLocale: string
  detectedTimeZone: string
}

export const determineAutoDetectedSettingsPatch = ({
  currentSettings,
  initialCookieLocale,
  initialCookieTimeZone,
  detectedLocale,
  detectedTimeZone,
}: AutoDetectSettingsInput): AutoDetectedSettingsPatch | null => {
  if (currentSettings.settingsAutoInitialized) {
    return null
  }

  return {
    locale: initialCookieLocale || detectedLocale,
    timeZone: initialCookieTimeZone || detectedTimeZone,
    autoInitialize: true,
  }
}
