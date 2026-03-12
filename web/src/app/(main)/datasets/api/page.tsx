import { DatasetsSwaggerUi } from "@/components/docs/datasets-swagger-ui"
import { getServerTranslator } from "@/lib/i18n-server"

const OPENAPI_SPEC_URL = "/api/docs/datasets/openapi.json"
const PROXY_BASE_URL = "/api/app"
const PUBLIC_API_BASE_URL = process.env.PUBLIC_API_URL || "http://localhost:8080/api/v1"

export default async function DatasetApiDocsPage() {
  const t = await getServerTranslator("ApiDocs")

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="container space-y-8 px-4 py-10 md:px-6">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
            {t("title")}
          </h1>
          <p className="max-w-3xl text-gray-600 dark:text-gray-300">{t("subtitle")}</p>
        </header>

        <section className="grid gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 dark:border-gray-800 dark:bg-gray-900">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t("recommendedServer")}</h2>
            <p className="break-all font-mono text-sm text-gray-700 dark:text-gray-200">{PROXY_BASE_URL}</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t("publicServer")}</h2>
            <p className="break-all font-mono text-sm text-gray-700 dark:text-gray-200">{PUBLIC_API_BASE_URL}</p>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("howToTitle")}</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700 dark:text-gray-200">
            <li>{t("howToAuth")}</li>
            <li>{t("howToTryIt")}</li>
            <li>{t("howToDownloadLimit")}</li>
          </ol>
        </section>

        <section className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("troubleshootingTitle")}</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700 dark:text-gray-200">
            <li>{t("troubleshootingAuth")}</li>
            <li>{t("troubleshootingOrigin")}</li>
            <li>{t("troubleshootingRateLimit")}</li>
          </ul>
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {t("specSourceLabel")}: <span className="font-mono">{OPENAPI_SPEC_URL}</span>
          </div>
          <DatasetsSwaggerUi specUrl={OPENAPI_SPEC_URL} />
        </section>
      </div>
    </div>
  )
}
