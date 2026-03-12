"use client"

import { NextIntlClientProvider } from "next-intl"

type I18nProviderProps = {
  locale: string
  timeZone: string
  messages: Record<string, unknown>
  children: React.ReactNode
}

export function I18nProvider({ locale, timeZone, messages, children }: I18nProviderProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  )
}
