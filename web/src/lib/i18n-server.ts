import { cookies } from "next/headers"
import path from "path"
import { readFile } from "fs/promises"
import { defaultLocale, locales } from "@/lib/locale"

const getLocaleFromCookies = async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value
  return (cookieLocale && locales.includes(cookieLocale as (typeof locales)[number])) ? cookieLocale : defaultLocale
}

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

const getMessages = async (locale: string) => {
  const basePath = path.join(process.cwd(), "messages", "en.json")
  const localePath = path.join(process.cwd(), "messages", `${locale}.json`)
  const [baseFile, localeFile] = await Promise.all([
    readFile(basePath, "utf-8"),
    readFile(localePath, "utf-8"),
  ])
  const baseMessages = JSON.parse(baseFile) as Record<string, any>
  const localeMessages = JSON.parse(localeFile) as Record<string, any>
  return mergeMessages(baseMessages, localeMessages)
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
