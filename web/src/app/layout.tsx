import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LocaleSync } from "@/components/locale-sync";
import { cookies } from "next/headers";
import path from "path";
import { readFile } from "fs/promises";
import { I18nProvider } from "@/components/i18n-provider";
import { defaultLocale, locales } from "@/lib/locale";

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
};

const mergeMessages = (base: Record<string, any>, overrides: Record<string, any>) => {
  const result = { ...base }
  Object.entries(overrides).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value) && typeof result[key] === "object") {
      result[key] = mergeMessages(result[key], value)
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
  const baseMessages = JSON.parse(baseFile)
  const localeMessages = JSON.parse(localeFile)
  return mergeMessages(baseMessages, localeMessages)
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = (cookieLocale && locales.includes(cookieLocale as (typeof locales)[number])) ? cookieLocale : defaultLocale;
  const messages = await getMessages(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider locale={locale} messages={messages}>
          <LocaleSync />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
