import { getServerTranslator } from "@/lib/i18n-server"

export default async function PrivacyPage() {
  const t = await getServerTranslator("LegalPrivacy")

  return (
    <div className="effect-readable-page min-h-screen bg-white dark:bg-gray-950">
      <div className="container px-4 py-16 md:px-6">
        <article className="mx-auto max-w-3xl space-y-8">
          <header className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t("title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">{t("intro")}</p>
          </header>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("collectTitle")}</h2>
            <p className="text-gray-600 dark:text-gray-300">{t("collectBody")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("deidentifyTitle")}</h2>
            <p className="text-gray-600 dark:text-gray-300">{t("deidentifyBody")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("controlTitle")}</h2>
            <p className="text-gray-600 dark:text-gray-300">{t("controlBody")}</p>
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
