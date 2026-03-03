import { getServerTranslator } from "@/lib/i18n-server"

const API_BASE_URL = process.env.PUBLIC_API_URL || process.env.INTERNAL_API_URL || "http://localhost:8080/api/v1"

const endpointList = [
  { method: "GET", path: "/surveys/public" },
  { method: "POST", path: "/surveys/:id/responses/start" },
  { method: "POST", path: "/responses/:id/submit" },
  { method: "GET", path: "/datasets" },
  { method: "GET", path: "/datasets/:id" },
  { method: "POST", path: "/datasets/:id/download" },
]

export default async function ApiDocsPage() {
  const t = await getServerTranslator("ApiDocs")

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="container px-4 py-16 md:px-6">
        <div className="mx-auto max-w-3xl space-y-8">
          <header className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">{t("title")}</h1>
            <p className="text-gray-600 dark:text-gray-300">{t("subtitle")}</p>
          </header>

          <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t("baseUrlTitle")}</h2>
            <p className="break-all font-mono text-sm text-gray-700 dark:text-gray-200">{API_BASE_URL}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("commonEndpoints")}</h2>
            <ul className="space-y-2">
              {endpointList.map((endpoint) => (
                <li
                  key={`${endpoint.method}-${endpoint.path}`}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800"
                >
                  <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                    {endpoint.method}
                  </span>
                  <span className="font-mono text-sm text-gray-700 dark:text-gray-200">{endpoint.path}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
