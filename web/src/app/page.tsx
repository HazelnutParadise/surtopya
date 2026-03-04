import Link from "next/link";
import { Button } from "@/components/ui/button";

import { Navbar } from "@/components/navbar";
import { HeroThreeBackground } from "@/components/marketing/hero-three-background";
import { cookies, headers } from "next/headers";
import { locales, withLocale } from "@/lib/locale";
import { getServerTranslator } from "@/lib/i18n-server";

export default async function Home() {
  const headerStore = await headers();
  const headerLocale = headerStore.get("x-locale");
  const localeCookieStore = await cookies();
  const localeFromCookie = localeCookieStore.get("NEXT_LOCALE")?.value || "zh-TW";
  const locale =
    headerLocale && locales.includes(headerLocale as (typeof locales)[number])
      ? headerLocale
      : localeFromCookie;
  const t = await getServerTranslator("Home");
  const currentYear = new Date().getFullYear();
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <section className="relative isolate flex min-h-[62vh] w-full items-center overflow-hidden bg-black py-12 text-white md:min-h-[70vh] md:py-20 lg:min-h-[74vh] lg:py-24">
          <div className="pointer-events-none absolute inset-0 opacity-90">
            <HeroThreeBackground />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/80" />
          <div className="container relative z-10 px-4 md:px-6">
            <div className="flex flex-col items-center space-y-6 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl leading-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
                  {t("heroTitle")}
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-300 md:text-xl">
                  {t("heroSubtitle")}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild className="bg-white text-black hover:bg-gray-200">
                  <Link href={withLocale("/create", locale)}>{t("getStarted")}</Link>
                </Button>
                <Button variant="outline" asChild className="border-white bg-transparent text-white hover:bg-white hover:text-black">
                  <Link href={withLocale("/explore", locale)}>{t("browseSurveys")}</Link>
                </Button>
                <Button variant="outline" asChild className="border-cyan-300/80 bg-cyan-400/10 text-cyan-100 hover:border-cyan-200 hover:bg-cyan-100 hover:text-black">
                  <Link href={withLocale("/datasets", locale)}>{t("browseDatasets")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full bg-gray-100 py-12 md:py-16 dark:bg-gray-800">
          <div className="container px-4 md:px-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl md:p-10 dark:border-gray-700 dark:bg-gray-900">
              <div className="grid gap-8 lg:grid-cols-[1.05fr_1.95fr] lg:gap-12">
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-purple-600 dark:text-purple-400">
                    Surtopya
                  </p>
                  <h2 className="text-2xl font-bold leading-tight text-gray-900 md:text-3xl dark:text-gray-100">
                    {t("featureSectionTitle")}
                  </h2>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {t("featureSectionDescription")}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <article className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                    <p className="text-xs font-semibold tracking-[0.18em] text-purple-500">01</p>
                    <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{t("featureOneTitle")}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{t("featureOneDescription")}</p>
                  </article>
                  <article className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                    <p className="text-xs font-semibold tracking-[0.18em] text-pink-500">02</p>
                    <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{t("featureTwoTitle")}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{t("featureTwoDescription")}</p>
                  </article>
                  <article className="rounded-2xl border border-gray-200/80 bg-white p-4 sm:col-span-2 lg:col-span-1 dark:border-gray-700 dark:bg-gray-900">
                    <p className="text-xs font-semibold tracking-[0.18em] text-blue-500">03</p>
                    <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{t("featureThreeTitle")}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{t("featureThreeDescription")}</p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("footerCopyright", { year: currentYear })}
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href={withLocale("/terms", locale)}>
            {t("footerTerms")}
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href={withLocale("/privacy", locale)}>
            {t("footerPrivacy")}
          </Link>
        </nav>
      </footer>
    </div>
  );
}
