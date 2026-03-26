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
          {/* Decorative glows */}
          <div className="pointer-events-none absolute -bottom-1/4 -right-1/4 z-0 h-[50%] w-[50%] rounded-full bg-cyan-500/15 blur-[100px]" />
          {/* Bottom transition to next section */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />
          {/* Floating decorative orbs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-[10%] top-[20%] h-2 w-2 animate-pulse rounded-full bg-purple-400/60" />
            <div className="absolute left-[25%] bottom-[25%] h-3 w-3 animate-pulse rounded-full bg-cyan-400/40" style={{ animationDelay: "1s" }} />
          </div>
          <MotionReveal className="container relative z-20 px-4 md:px-6" delayMs={40}>
            <div className="flex flex-col items-center space-y-6 text-center">
              <div className="space-y-2">
                <h1 className="relative z-30 overflow-visible text-4xl leading-tight font-bold tracking-tighter text-white [text-shadow:0_10px_30px_rgba(0,0,0,0.45)] sm:text-5xl md:text-6xl lg:text-7xl">
                  <span className="relative z-10 bg-[linear-gradient(90deg,#60a5fa_0%,#8b5cf6_38%,#ec4899_68%,#f472b6_100%)] bg-clip-text text-transparent [--webkit-text-fill-color:transparent]">
                    {t("heroTitle")}
                  </span>
                </h1>
                <p className="mx-auto max-w-[760px] text-base text-gray-300 md:text-2xl lg:text-3xl">
                  {t("heroSubtitle")}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild className="group relative transform-gpu overflow-hidden bg-gradient-to-r from-white to-gray-100 px-6 py-2.5 text-black shadow-lg shadow-white/20 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-white/30 active:scale-[0.98]">
                  <Link href={withLocale("/create", locale)}>
                    <span className="relative z-10">{t("getStarted")}</span>
                  </Link>
                </Button>
                <Button variant="outline" asChild className="transform-gpu border-white/30 bg-slate-950/70 px-6 py-2.5 text-white backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-white/50 hover:bg-slate-900/80 hover:text-white active:scale-[0.98]">
                  <Link href={withLocale("/explore", locale)}>{t("browseSurveys")}</Link>
                </Button>
                <Button variant="outline" asChild className="transform-gpu border-cyan-300/60 bg-cyan-950/70 px-6 py-2.5 text-cyan-100 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cyan-200/80 hover:bg-cyan-900/80 hover:text-cyan-50 active:scale-[0.98]">
                  <Link href={withLocale("/datasets", locale)}>{t("browseDatasets")}</Link>
                </Button>
              </div>
            </div>
          </MotionReveal>
          <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 md:bottom-8">
            <HeroScrollButton targetId="home-features" label="Scroll to homepage features" />
          </div>
        </section>
        <MotionReveal id="home-features" className="relative w-full bg-slate-950 py-12 md:py-16" delayMs={110}>
          {/* Top decorative line */}
          <div className="pointer-events-none absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
          {/* Left side glow */}
          <div className="pointer-events-none absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-purple-600/10 blur-[100px]" />
          <div className="container px-4 md:px-6">
            <div className="relative rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-900/95 to-slate-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-sm md:p-10">
              {/* Card top shine */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
              <div className="grid gap-8 lg:grid-cols-[1.05fr_1.95fr] lg:gap-12">
                <div className="space-y-4">
                  <p className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-purple-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
                    Surtopya
                  </p>
                  <h2 className="text-2xl font-bold leading-tight md:text-3xl lg:text-4xl">
                    <span className="bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-transparent">
                      {t("featureSectionTitle")}
                    </span>
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-300 lg:text-base">
                    {t("featureSectionDescription")}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <article className="group relative transform-gpu overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 transition-all duration-400 ease-out hover:-translate-y-1.5 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-900/20 lg:p-6">
                    {/* Hover top bar */}
                    <div className="absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 transition-transform duration-300 group-hover:scale-x-100" />
                    {/* Hover gradient background */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <p className="relative inline-flex items-center justify-center rounded-lg bg-purple-500/10 px-2.5 py-1 text-xs font-bold tracking-[0.2em] text-purple-400">01</p>
                    <h3 className="mt-3 text-lg font-semibold text-slate-100 lg:text-xl">{t("featureOneTitle")}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300 lg:text-base">{t("featureOneDescription")}</p>
                    <p className="mt-2 text-xs font-medium text-purple-400/90 lg:text-sm">{t("featureOneNote")}</p>
                  </article>
                  <article className="group relative transform-gpu overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 transition-all duration-400 ease-out hover:-translate-y-1.5 hover:border-pink-500/50 hover:shadow-xl hover:shadow-pink-900/20 lg:p-6">
                    {/* Hover top bar */}
                    <div className="absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 transition-transform duration-300 group-hover:scale-x-100" />
                    {/* Hover gradient background */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <p className="relative inline-flex items-center justify-center rounded-lg bg-pink-500/10 px-2.5 py-1 text-xs font-bold tracking-[0.2em] text-pink-400">02</p>
                    <h3 className="mt-3 text-lg font-semibold text-slate-100 lg:text-xl">{t("featureTwoTitle")}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300 lg:text-base">{t("featureTwoDescription")}</p>
                    <p className="mt-2 text-xs font-medium text-pink-400/90 lg:text-sm">{t("featureTwoNote")}</p>
                  </article>
                  <article className="group relative transform-gpu overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 transition-all duration-400 ease-out hover:-translate-y-1.5 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-900/20 sm:col-span-2 lg:col-span-1 lg:p-6">
                    {/* Hover top bar */}
                    <div className="absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 transition-transform duration-300 group-hover:scale-x-100" />
                    {/* Hover gradient background */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <p className="relative inline-flex items-center justify-center rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-bold tracking-[0.2em] text-blue-400">03</p>
                    <h3 className="mt-3 text-lg font-semibold text-slate-100 lg:text-xl">{t("featureThreeTitle")}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300 lg:text-base">{t("featureThreeDescription")}</p>
                    <p className="mt-2 text-xs font-medium text-blue-400/90 lg:text-sm">{t("featureThreeNote")}</p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </MotionReveal>
        <MotionReveal className="relative w-full overflow-hidden bg-gradient-to-b from-white via-gray-50 to-white py-12 md:py-16 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" delayMs={150}>
          {/* Top transition from Features section */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-950 to-transparent dark:from-slate-950" />
          {/* Decorative background glows */}
          <div className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full bg-purple-200/30 blur-[100px] dark:bg-purple-800/20" />
          <div className="pointer-events-none absolute -left-32 bottom-40 h-80 w-80 rounded-full bg-cyan-200/20 blur-[80px] dark:bg-cyan-800/15" />
          <div className="container px-4 md:px-6">
            <div className="relative space-y-8 rounded-3xl border border-gray-200/80 bg-white/80 p-6 shadow-xl shadow-gray-200/50 backdrop-blur-sm md:p-10 dark:border-gray-800/60 dark:bg-gray-900/60 dark:shadow-black/30">
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
                <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 hover:shadow-lg hover:shadow-purple-100/50 lg:p-6 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-purple-700 dark:hover:shadow-purple-900/20">
                  {/* Hover background gradient */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-50/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-80 dark:from-purple-900/10 dark:group-hover:opacity-100" />
                  <div className="relative mb-3 inline-flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-xs font-bold text-white shadow-md shadow-purple-500/30">01</span>
                  </div>
                  <h3 className="relative mt-2 text-lg font-semibold text-gray-900 transition-colors duration-300 group-hover:text-gray-950 lg:text-xl dark:text-white dark:group-hover:text-white">{t("gameplayStepOneTitle")}</h3>
                  <p className="mt-2 text-sm text-gray-700 transition-colors duration-300 group-hover:text-gray-800 lg:text-base dark:text-gray-300 dark:group-hover:text-gray-200">{t("gameplayStepOneDescription")}</p>
                  <p className="mt-2 text-xs font-medium text-purple-700/90 transition-colors duration-300 group-hover:text-purple-800 lg:text-sm dark:text-purple-400/80 dark:group-hover:text-purple-300">{t("gameplayStepOneNote")}</p>
                </article>
                <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-pink-300 hover:shadow-lg hover:shadow-pink-100/50 lg:p-6 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-pink-700 dark:hover:shadow-pink-900/20">
                  {/* Hover background gradient */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pink-50/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-80 dark:from-pink-900/10 dark:group-hover:opacity-100" />
                  <div className="relative mb-3 inline-flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-pink-600 text-xs font-bold text-white shadow-md shadow-pink-500/30">02</span>
                  </div>
                  <h3 className="relative mt-2 text-lg font-semibold text-gray-900 transition-colors duration-300 group-hover:text-gray-950 lg:text-xl dark:text-white dark:group-hover:text-white">{t("gameplayStepTwoTitle")}</h3>
                  <p className="mt-2 text-sm text-gray-700 transition-colors duration-300 group-hover:text-gray-800 lg:text-base dark:text-gray-300 dark:group-hover:text-gray-200">{t("gameplayStepTwoDescription")}</p>
                  <p className="mt-2 text-xs font-medium text-pink-700/90 transition-colors duration-300 group-hover:text-pink-800 lg:text-sm dark:text-pink-400/80 dark:group-hover:text-pink-300">{t("gameplayStepTwoNote")}</p>
                </article>
                <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 lg:p-6 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-blue-700 dark:hover:shadow-blue-900/20">
                  {/* Hover background gradient */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-50/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-80 dark:from-blue-900/10 dark:group-hover:opacity-100" />
                  <div className="relative mb-3 inline-flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-bold text-white shadow-md shadow-blue-500/30">03</span>
                  </div>
                  <h3 className="relative mt-2 text-lg font-semibold text-gray-900 transition-colors duration-300 group-hover:text-gray-950 lg:text-xl dark:text-white dark:group-hover:text-white">{t("gameplayStepThreeTitle")}</h3>
                  <p className="mt-2 text-sm text-gray-700 transition-colors duration-300 group-hover:text-gray-800 lg:text-base dark:text-gray-300 dark:group-hover:text-gray-200">{t("gameplayStepThreeDescription")}</p>
                  <p className="mt-2 text-xs font-medium text-blue-700/90 transition-colors duration-300 group-hover:text-blue-800 lg:text-sm dark:text-blue-400/80 dark:group-hover:text-blue-300">{t("gameplayStepThreeNote")}</p>
                </article>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50/50 p-5 shadow-sm dark:border-sky-900/60 dark:from-sky-950/40 dark:to-cyan-950/20">
                {/* Decorative glow */}
                <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-sky-200/40 blur-2xl dark:bg-sky-800/20" />
                <div className="space-y-2">
                  <h3 className="relative text-lg font-semibold text-sky-900 lg:text-xl dark:text-sky-100">
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
                <article className="group relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-200/50 dark:border-indigo-800/60 dark:from-indigo-950/50 dark:to-purple-950/30 dark:hover:shadow-indigo-900/30">
                  {/* Background decorative circle */}
                  <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-indigo-200/50 blur-2xl transition-transform duration-500 group-hover:scale-150 dark:bg-indigo-800/30" />
                  <h3 className="relative text-lg font-semibold text-indigo-900 lg:text-xl dark:text-indigo-100">{t("roleResearchersTitle")}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-indigo-800 lg:text-base dark:text-indigo-200">
                    {t("roleResearchersDescription")}
                  </p>
                </article>
                <article className="group relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-200/50 dark:border-emerald-800/60 dark:from-emerald-950/50 dark:to-green-950/30 dark:hover:shadow-emerald-900/30">
                  {/* Background decorative circle */}
                  <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-200/50 blur-2xl transition-transform duration-500 group-hover:scale-150 dark:bg-emerald-800/30" />
                  <h3 className="relative text-lg font-semibold text-emerald-900 lg:text-xl dark:text-emerald-100">{t("roleParticipantsTitle")}</h3>
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
