import { getServerTranslator } from "@/lib/i18n-server";

export default async function AboutPage() {
  const t = await getServerTranslator("About");
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="container px-4 py-20 md:px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
              {t("title")} <span className="text-purple-600">Surtopya</span>
            </h1>
            <p className="text-xl text-gray-500 dark:text-gray-400">
              {t("subtitle")}
            </p>
          </div>

          <div className="prose prose-lg dark:prose-invert mx-auto text-gray-600 dark:text-gray-300">
            <p>
              {t("intro")}
            </p>
            
            <h3 className="text-gray-900 dark:text-white font-bold text-2xl mt-8 mb-4">{t("mission")}</h3>
            <p>
              {t("missionText")}
            </p>

            <h3 className="text-gray-900 dark:text-white font-bold text-2xl mt-8 mb-4">{t("whyChooseUs")}</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>{t("whyQualityTitle")}</strong> {t("whyQualityText")}
              </li>
              <li>
                <strong>{t("whyRewardsTitle")}</strong> {t("whyRewardsText")}
              </li>
              <li>
                <strong>{t("whyAssetsTitle")}</strong> {t("whyAssetsText")}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
