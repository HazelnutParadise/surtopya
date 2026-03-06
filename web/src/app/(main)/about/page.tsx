import { getServerTranslator } from "@/lib/i18n-server";
import { MotionReveal, PageMotionShell } from "@/components/motion";

export default async function AboutPage() {
  const t = await getServerTranslator("About");
  return (
    <PageMotionShell className="effect-readable-page min-h-screen bg-transparent">
      <div className="container px-4 py-20 md:px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <MotionReveal className="text-center space-y-4" delayMs={40}>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
              {t("title")} <span className="text-purple-600">Surtopya</span>
            </h1>
            <p className="text-xl text-gray-500 dark:text-gray-400">
              {t("subtitle")}
            </p>
          </MotionReveal>

          <div className="prose prose-lg dark:prose-invert mx-auto text-gray-600 dark:text-gray-300">
            <MotionReveal delayMs={80}>
              <p>
              {t("intro")}
              </p>
            </MotionReveal>
            
            <MotionReveal delayMs={130}>
              <h3 className="text-gray-900 dark:text-white font-bold text-2xl mt-8 mb-4">{t("mission")}</h3>
              <p>
                {t("missionText")}
              </p>
            </MotionReveal>

            <MotionReveal delayMs={180}>
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
            </MotionReveal>
          </div>
        </div>
      </div>
    </PageMotionShell>
  );
}
