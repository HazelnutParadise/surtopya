import Link from "next/link";
import { Button } from "@/components/ui/button";

import { Navbar } from "@/components/navbar";
import { HeroThreeBackground } from "@/components/marketing/hero-three-background";
import { HeroScrollButton } from "@/components/marketing/hero-scroll-button";
import { cookies, headers } from "next/headers";
import { defaultLocale, locales, withLocale } from "@/lib/locale";
import { getServerTranslator } from "@/lib/i18n-server";
import { MotionReveal, PageMotionShell } from "@/components/motion";
import { SiteFooter } from "@/components/site-footer";

export default async function Home() {
  const headerStore = await headers();
  const headerLocale = headerStore.get("x-locale");
  const localeCookieStore = await cookies();
  const localeFromCookie = localeCookieStore.get("NEXT_LOCALE")?.value || defaultLocale;
  const locale =
    headerLocale && locales.includes(headerLocale as (typeof locales)[number])
      ? headerLocale
      : localeFromCookie;
  const t = await getServerTranslator("Home");
  return (
    <PageMotionShell className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="relative isolate flex min-h-[74vh] w-full items-center overflow-hidden bg-black py-14 text-white md:min-h-[82vh] md:py-24 lg:min-h-[88vh] lg:py-28">
          <div className="pointer-events-none absolute inset-0 opacity-90">
            <HeroThreeBackground />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/80" />
          <MotionReveal className="container relative z-10 px-4 md:px-6" delayMs={40}>
            <div className="flex flex-col items-center space-y-6 text-center">
              <div className="space-y-2">
                <h1 className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-4xl leading-tight font-bold tracking-tighter text-transparent sm:text-5xl md:text-6xl lg:text-7xl">
                  {t("heroTitle")}
                </h1>
                <p className="mx-auto max-w-[760px] text-base text-gray-300 md:text-2xl lg:text-3xl">
                  {t("heroSubtitle")}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild className="transform-gpu bg-white text-black transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-gray-200 active:scale-[0.98]">
                  <Link href={withLocale("/create", locale)}>{t("getStarted")}</Link>
                </Button>
                <Button variant="outline" asChild className="transform-gpu border-white bg-transparent text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white hover:text-black active:scale-[0.98]">
                  <Link href={withLocale("/explore", locale)}>{t("browseSurveys")}</Link>
                </Button>
                <Button variant="outline" asChild className="transform-gpu border-cyan-300/80 bg-cyan-400/10 text-cyan-100 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-100 hover:text-black active:scale-[0.98]">
                  <Link href={withLocale("/datasets", locale)}>{t("browseDatasets")}</Link>
                </Button>
              </div>
            </div>
          </MotionReveal>
          <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 md:bottom-8">
            <HeroScrollButton targetId="home-features" label="Scroll to homepage features" />
          </div>
        </section>
        <MotionReveal id="home-features" className="w-full bg-slate-950 py-12 md:py-16" delayMs={110}>
          <div className="container px-4 md:px-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/35 md:p-10">
              <div className="grid gap-8 lg:grid-cols-[1.05fr_1.95fr] lg:gap-12">
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-purple-400">
                    Surtopya
                  </p>
                  <h2 className="text-2xl font-bold leading-tight text-gray-100 md:text-3xl lg:text-4xl">
                    {t("featureSectionTitle")}
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-300 lg:text-base">
                    {t("featureSectionDescription")}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <article className="transform-gpu rounded-2xl border border-slate-700/80 bg-slate-900 p-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-500 hover:shadow-lg hover:shadow-slate-900/60 lg:p-6">
                    <p className="text-xs font-semibold tracking-[0.18em] text-purple-500">01</p>
                    <h3 className="mt-3 text-lg font-semibold text-slate-100 lg:text-xl">{t("featureOneTitle")}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300 lg:text-base">{t("featureOneDescription")}</p>
                    <p className="mt-2 text-xs font-medium text-purple-400/90 lg:text-sm">{t("featureOneNote")}</p>
                  </article>
                  <article className="transform-gpu rounded-2xl border border-slate-700/80 bg-slate-900 p-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-500 hover:shadow-lg hover:shadow-slate-900/60 lg:p-6">
                    <p className="text-xs font-semibold tracking-[0.18em] text-pink-500">02</p>
                    <h3 className="mt-3 text-lg font-semibold text-slate-100 lg:text-xl">{t("featureTwoTitle")}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300 lg:text-base">{t("featureTwoDescription")}</p>
                    <p className="mt-2 text-xs font-medium text-pink-400/90 lg:text-sm">{t("featureTwoNote")}</p>
                  </article>
                  <article className="transform-gpu rounded-2xl border border-slate-700/80 bg-slate-900 p-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-500 hover:shadow-lg hover:shadow-slate-900/60 sm:col-span-2 lg:col-span-1 lg:p-6">
                    <p className="text-xs font-semibold tracking-[0.18em] text-blue-500">03</p>
                    <h3 className="mt-3 text-lg font-semibold text-slate-100 lg:text-xl">{t("featureThreeTitle")}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300 lg:text-base">{t("featureThreeDescription")}</p>
                    <p className="mt-2 text-xs font-medium text-blue-400/90 lg:text-sm">{t("featureThreeNote")}</p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </MotionReveal>
        <MotionReveal className="w-full bg-white py-12 md:py-16 dark:bg-gray-950" delayMs={150}>
          <div className="container px-4 md:px-6">
            <div className="space-y-8 rounded-3xl border border-gray-200 bg-gray-50 p-6 md:p-10 dark:border-gray-800 dark:bg-gray-900/70">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-400">
                  {t("gameplayTag")}
                </p>
                <h2 className="text-2xl font-bold text-gray-900 md:text-3xl lg:text-4xl dark:text-white">
                  {t("gameplaySectionTitle")}
                </h2>
                <p className="max-w-3xl text-sm leading-relaxed text-gray-600 lg:text-base dark:text-gray-300">
                  {t("gameplaySectionDescription")}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <article className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-xs font-semibold tracking-[0.18em] text-purple-500">01</p>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900 lg:text-xl dark:text-white">{t("gameplayStepOneTitle")}</h3>
                  <p className="mt-2 text-sm text-gray-600 lg:text-base dark:text-gray-300">{t("gameplayStepOneDescription")}</p>
                  <p className="mt-2 text-xs font-medium text-purple-500/80 lg:text-sm dark:text-purple-400/80">{t("gameplayStepOneNote")}</p>
                </article>
                <article className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-xs font-semibold tracking-[0.18em] text-pink-500">02</p>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900 lg:text-xl dark:text-white">{t("gameplayStepTwoTitle")}</h3>
                  <p className="mt-2 text-sm text-gray-600 lg:text-base dark:text-gray-300">{t("gameplayStepTwoDescription")}</p>
                  <p className="mt-2 text-xs font-medium text-pink-500/80 lg:text-sm dark:text-pink-400/80">{t("gameplayStepTwoNote")}</p>
                </article>
                <article className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-xs font-semibold tracking-[0.18em] text-blue-500">03</p>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900 lg:text-xl dark:text-white">{t("gameplayStepThreeTitle")}</h3>
                  <p className="mt-2 text-sm text-gray-600 lg:text-base dark:text-gray-300">{t("gameplayStepThreeDescription")}</p>
                  <p className="mt-2 text-xs font-medium text-blue-500/80 lg:text-sm dark:text-blue-400/80">{t("gameplayStepThreeNote")}</p>
                </article>
              </div>

              <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/70 dark:bg-sky-950/30">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-sky-900 lg:text-xl dark:text-sky-100">
                    {t("pointsUsageTitle")}
                  </h3>
                  <p className="text-sm leading-relaxed text-sky-800 lg:text-base dark:text-sky-200">
                    {t("pointsUsageDescription")}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <article className="rounded-xl border border-sky-200 bg-white p-4 dark:border-sky-900/60 dark:bg-slate-950">
                    <p className="text-sm font-semibold text-gray-900 lg:text-base dark:text-gray-100">{t("pointsUsageBoostTitle")}</p>
                    <p className="mt-2 text-sm text-gray-600 lg:text-base dark:text-gray-300">{t("pointsUsageBoostDescription")}</p>
                  </article>
                  <article className="rounded-xl border border-sky-200 bg-white p-4 dark:border-sky-900/60 dark:bg-slate-950">
                    <p className="text-sm font-semibold text-gray-900 lg:text-base dark:text-gray-100">{t("pointsUsageDownloadTitle")}</p>
                    <p className="mt-2 text-sm text-gray-600 lg:text-base dark:text-gray-300">{t("pointsUsageDownloadDescription")}</p>
                  </article>
                  <article className="rounded-xl border border-sky-200 bg-white p-4 dark:border-sky-900/60 dark:bg-slate-950">
                    <p className="text-sm font-semibold text-gray-900 lg:text-base dark:text-gray-100">{t("pointsUsageEarnTitle")}</p>
                    <p className="mt-2 text-sm text-gray-600 lg:text-base dark:text-gray-300">{t("pointsUsageEarnDescription")}</p>
                  </article>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-800/70 dark:bg-indigo-950/40">
                  <h3 className="text-lg font-semibold text-indigo-900 lg:text-xl dark:text-indigo-100">{t("roleResearchersTitle")}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-indigo-800 lg:text-base dark:text-indigo-200">
                    {t("roleResearchersDescription")}
                  </p>
                </article>
                <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800/70 dark:bg-emerald-950/40">
                  <h3 className="text-lg font-semibold text-emerald-900 lg:text-xl dark:text-emerald-100">{t("roleParticipantsTitle")}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-800 lg:text-base dark:text-emerald-200">
                    {t("roleParticipantsDescription")}
                  </p>
                </article>
              </div>
            </div>
          </div>
        </MotionReveal>
      </main>
      <SiteFooter />
    </PageMotionShell>
  );
}
