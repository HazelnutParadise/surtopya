import { cookies } from "next/headers"
import path from "path"
import { readFile } from "fs/promises"
import { defaultLocale, locales } from "@/lib/locale"

const getLocaleFromCookies = async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value
  return (cookieLocale && locales.includes(cookieLocale as (typeof locales)[number])) ? cookieLocale : defaultLocale
}

const getMessages = async (locale: string) => {
  const messagesPath = path.join(process.cwd(), "messages", `${locale}.json`)
  const file = await readFile(messagesPath, "utf-8")
  return JSON.parse(file) as Record<string, any>
}

const resolveMessage = (messages: Record<string, any>, key: string) => {
  return key.split(".").reduce((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return acc[part]
    }
    return undefined
  }, messages as any)
}

const formatMessage = (message: string, values?: Record<string, string | number>) => {
  if (!values) return message
  return Object.entries(values).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{${key}}`, String(value))
  }, message)
}

export const getServerTranslator = async (namespace?: string) => {
  const locale = await getLocaleFromCookies()
  const messages = await getMessages(locale)

  return (key: string, values?: Record<string, string | number>) => {
    const messageKey = namespace ? `${namespace}.${key}` : key
    const message = resolveMessage(messages, messageKey)
    if (typeof message !== "string") {
      return messageKey
    }
    return formatMessage(message, values)
  }
}
