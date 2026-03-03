import { getServerTranslator } from "@/lib/i18n-server"

export default async function TermsPage() {
  const t = await getServerTranslator("LegalTerms")

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="container px-4 py-16 md:px-6">
        <article className="mx-auto max-w-3xl space-y-8">
          <header className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t("title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">{t("intro")}</p>
          </header>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("useTitle")}</h2>
            <p className="text-gray-600 dark:text-gray-300">{t("useBody")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("contentTitle")}</h2>
            <p className="text-gray-600 dark:text-gray-300">{t("contentBody")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("availabilityTitle")}</h2>
            <p className="text-gray-600 dark:text-gray-300">{t("availabilityBody")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("contactTitle")}</h2>
            <p className="text-gray-600 dark:text-gray-300">{t("contactBody")}</p>
          </section>

          <p className="text-xs text-gray-500 dark:text-gray-400">{t("summaryNote")}</p>
        </article>
      </div>
    </div>
  )
}
