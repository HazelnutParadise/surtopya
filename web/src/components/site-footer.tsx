"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { getLocaleFromPath, withLocale } from "@/lib/locale"
import { useTranslations } from "next-intl"

const getPathWithoutLocale = (pathname: string, locale: string) => {
  const withPrefix = `/${locale}`
  if (pathname === withPrefix) return "/"
  if (pathname.startsWith(`${withPrefix}/`)) {
    return pathname.slice(withPrefix.length)
  }
  return pathname
}

const shouldRenderFooter = (pathname: string) => {
  if (pathname === "/") return true
  if (pathname === "/about") return true
  if (pathname === "/pricing") return true
  if (pathname === "/explore") return true
  if (pathname === "/terms") return true
  if (pathname === "/privacy") return true
  if (pathname === "/datasets") return true
  if (pathname.startsWith("/datasets/")) return true
  return false
}

export function SiteFooter() {
  const pathname = usePathname()
  const locale = getLocaleFromPath(pathname)
  const withLocalePath = (href: string) => withLocale(href, locale)
  const t = useTranslations("Home")
  const currentYear = new Date().getFullYear()
  const pathWithoutLocale = getPathWithoutLocale(pathname, locale)

  if (!shouldRenderFooter(pathWithoutLocale)) {
    return null
  }

  return (
    <footer
      data-testid="site-footer"
      className="flex w-full shrink-0 flex-col items-center gap-2 border-t bg-white px-4 py-6 dark:bg-gray-950 sm:flex-row md:px-6"
    >
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t("footerCopyright", { year: currentYear })}
      </p>
      <nav className="flex gap-4 sm:ml-auto sm:gap-6">
        <Link className="text-xs hover:underline underline-offset-4" href={withLocalePath("/terms")}>
          {t("footerTerms")}
        </Link>
        <Link className="text-xs hover:underline underline-offset-4" href={withLocalePath("/privacy")}>
          {t("footerPrivacy")}
        </Link>
        <a
          className="text-xs hover:underline underline-offset-4"
          href="https://hazelnut-paradise.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("footerHazelnutParadise")}
        </a>
      </nav>
    </footer>
  )
}
