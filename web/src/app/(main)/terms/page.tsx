import { getServerTranslator } from "@/lib/i18n-server"
import { MotionReveal, PageMotionShell } from "@/components/motion"

export default async function TermsPage() {
  const t = await getServerTranslator("LegalTerms")

  return (
    <PageMotionShell className="effect-readable-page min-h-screen bg-transparent">
      <div className="container px-4 py-16 md:px-6">
        <article className="mx-auto max-w-3xl space-y-8">
          <MotionReveal className="space-y-3" delayMs={40}>
            <header className="space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                {t("title")}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">{t("intro")}</p>
            </header>
          </MotionReveal>

          <MotionReveal className="space-y-2" delayMs={90}>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("useTitle")}</h2>
              <p className="text-gray-600 dark:text-gray-300">{t("useBody")}</p>
            </section>
          </MotionReveal>

          <MotionReveal className="space-y-2" delayMs={130}>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("contentTitle")}</h2>
              <p className="text-gray-600 dark:text-gray-300">{t("contentBody")}</p>
            </section>
          </MotionReveal>

          <MotionReveal className="space-y-2" delayMs={170}>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("availabilityTitle")}</h2>
              <p className="text-gray-600 dark:text-gray-300">{t("availabilityBody")}</p>
            </section>
          </MotionReveal>

          <MotionReveal className="space-y-2" delayMs={210}>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("contactTitle")}</h2>
              <p className="text-gray-600 dark:text-gray-300">{t("contactBody")}</p>
            </section>
          </MotionReveal>

          <MotionReveal delayMs={240}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("summaryNote")}</p>
          </MotionReveal>

        </article>
      </div>
    </PageMotionShell>
  )
}
