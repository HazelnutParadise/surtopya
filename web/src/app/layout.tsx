import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { LocaleSync } from "@/components/locale-sync"
import { cookies, headers } from "next/headers"
import path from "path"
import { readFile } from "fs/promises"
import { I18nProvider } from "@/components/i18n-provider"
import { defaultLocale, locales } from "@/lib/locale"
import { DEFAULT_TIME_ZONE, normalizePersistedTimeZone } from "@/lib/date-time"
import { getLogtoConfig } from "@/lib/logto"
import { getLogtoContext } from "@logto/next/server-actions"
import { redirect } from "next/navigation"
import { SiteEffectsLayer } from "@/components/effects"
import { LOCALE_COOKIE_NAME, TIME_ZONE_COOKIE_NAME } from "@/lib/user-settings"
import { fetchInternalApp } from "@/lib/internal-app-fetch"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Surtopya - Privacy-Preserving Survey Platform",
  description: "Create surveys and share de-identified datasets securely.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

type Messages = Record<string, unknown>

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

const mergeMessages = (base: Messages, overrides: Messages) => {
  const result: Messages = { ...base }
  Object.entries(overrides).forEach(([key, value]) => {
    const existing = result[key]
    if (isPlainObject(value) && isPlainObject(existing)) {
      result[key] = mergeMessages(existing, value)
    } else {
      result[key] = value
    }
  })
  return result
}

async function getMessages(locale: string) {
  const basePath = path.join(process.cwd(), "messages", "en.json")
  const localePath = path.join(process.cwd(), "messages", `${locale}.json`)
  const [baseFile, localeFile] = await Promise.all([
    readFile(basePath, "utf-8"),
    readFile(localePath, "utf-8"),
  ])
  const baseMessages = JSON.parse(baseFile) as Messages
  const localeMessages = JSON.parse(localeFile) as Messages
  return mergeMessages(baseMessages, localeMessages)
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers()
  const headerLocale = headerStore.get("x-locale")

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const cookieTimeZone = cookieStore.get(TIME_ZONE_COOKIE_NAME)?.value
  const locale =
    headerLocale && locales.includes(headerLocale as (typeof locales)[number])
      ? headerLocale
      : cookieLocale && locales.includes(cookieLocale as (typeof locales)[number])
        ? cookieLocale
        : defaultLocale
  const timeZone = normalizePersistedTimeZone(cookieTimeZone, DEFAULT_TIME_ZONE)

  const messages = await getMessages(locale);
  const bootstrapResponse = await fetchInternalApp(`/bootstrap`, { cache: "no-store" }).catch(() => null)
  const bootstrapPayload = bootstrapResponse?.ok ? await bootstrapResponse.json() : null
  const hasSuperAdmin = Boolean(bootstrapPayload?.hasSuperAdmin)

  let isAuthenticated = false
  try {
    const config = await getLogtoConfig()
    const context = await getLogtoContext(config)
    isAuthenticated = context.isAuthenticated
  } catch {
    isAuthenticated = false
  }

  const requireBootstrapAuth = process.env.REQUIRE_BOOTSTRAP_AUTH === "true"
  if (requireBootstrapAuth && !hasSuperAdmin && !isAuthenticated) {
    redirect("/api/logto/sign-in")
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider locale={locale} timeZone={timeZone} messages={messages}>
          <SiteEffectsLayer />
          <LocaleSync />
          <div className="relative z-10">
            {children}
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
