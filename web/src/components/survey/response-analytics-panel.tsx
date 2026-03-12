"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, BarChart3 } from "lucide-react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { normalizeSurveyResponseAnalytics, type SurveyResponseAnalytics } from "@/lib/api"

interface ResponseAnalyticsPanelProps {
  analytics: SurveyResponseAnalytics | null
  loading: boolean
  error: string | null
  selectedVersion: string
  onVersionChange: (value: string) => void
}

const roundPercent = (value: number) => `${Math.round(value)}%`

export function ResponseAnalyticsPanel({
  analytics,
  loading,
  error,
  selectedVersion,
  onVersionChange,
}: ResponseAnalyticsPanelProps) {
  const t = useTranslations("SurveyManagement")
  const safeAnalytics = useMemo(
    () => normalizeSurveyResponseAnalytics(analytics, selectedVersion),
    [analytics, selectedVersion]
  )

  const [selectedPageID, setSelectedPageID] = useState("")

  useEffect(() => {
    setSelectedPageID(safeAnalytics.pages[0]?.pageId || "")
  }, [safeAnalytics.pages, selectedVersion])

  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
        {t("responseAnalyticsLoading")}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{t("responseAnalyticsError")}</p>
            <p className="mt-1 text-xs opacity-90">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return null
  }

  const versionOptions = [
    { value: "all", label: t("responseAnalyticsVersionAll") },
    ...safeAnalytics.availableVersions.map((version) => ({
      value: String(version),
      label: t("responseAnalyticsVersionSingle", { version }),
    })),
  ]
  const activePage =
    safeAnalytics.pages.find((page) => page.pageId === selectedPageID) || safeAnalytics.pages[0] || null

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("responseAnalyticsTitle")}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("responseAnalyticsDescription")}</p>
        </div>
        <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
          <span>{t("responseAnalyticsVersionLabel")}</span>
          <select
            data-testid="response-analytics-version-select"
            value={selectedVersion}
            onChange={(event) => onVersionChange(event.target.value)}
            className="min-w-[180px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-purple-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            {versionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {safeAnalytics.warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">{t("responseAnalyticsWarningsTitle")}</p>
              {safeAnalytics.warnings.map((warning) => (
                <p key={warning} className="text-xs opacity-90">
                  {warning}
                </p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {safeAnalytics.summary.totalCompletedResponses === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
          {t("responseAnalyticsNoResponses")}
        </div>
      ) : (
        <div className="space-y-4">
          {safeAnalytics.pages.length > 0 ? (
            <div
              className="overflow-x-auto pb-1"
              data-testid="response-analytics-page-tabs"
            >
              <div className="flex min-w-max gap-2" role="tablist" aria-label={t("responseAnalyticsTitle")}>
                {safeAnalytics.pages.map((page, index) => {
                  const pageLabel = page.title || t("responseAnalyticsPageLabel", { page: index + 1 })
                  const isActive = activePage?.pageId === page.pageId

                  return (
                    <button
                      key={page.pageId || `page-${index + 1}`}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setSelectedPageID(page.pageId)}
                      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/40 dark:text-sky-200"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 dark:hover:text-white"
                      }`}
                    >
                      {pageLabel}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {activePage?.description ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{activePage.description}</p>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            {(activePage?.questions || []).map((question) => (
              <Card
                key={question.questionId}
                className="flex h-[26rem] flex-col overflow-hidden border-gray-200/80 dark:border-gray-800"
              >
                <CardHeader className="gap-3">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="text-base">{question.title}</CardTitle>
                      {question.description ? (
                        <CardDescription className="mt-1">{question.description}</CardDescription>
                      ) : null}
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                      <BarChart3 className="h-3.5 w-3.5" />
                      {question.questionType}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {t("responseAnalyticsResponsesCount", { count: question.responseCount })}
                  </p>
                </CardHeader>
                <CardContent
                  data-testid={`response-analytics-card-scroll-${question.questionId}`}
                  className="flex-1 space-y-4 overflow-y-auto"
                >
                  {question.averageRating != null ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-950/30 dark:text-purple-200">
                      <span>{t("responseAnalyticsAverageLabel")}</span>
                      <span>{question.averageRating.toFixed(1)}</span>
                    </div>
                  ) : null}

                  {question.optionCounts.length > 0 ? (
                    <div className="space-y-3">
                      {question.optionCounts.map((option) => (
                        <div key={`${question.questionId}-${option.label}`} className="space-y-1">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate text-gray-700 dark:text-gray-200">{option.label}</span>
                            <span className="shrink-0 text-gray-500 dark:text-gray-400">
                              {option.count} 繚 {roundPercent(option.percentage)}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-900">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-[width]"
                              style={{ width: `${Math.max(option.percentage, 0)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {question.textResponses.length > 0 ? (
                    <div className="space-y-2">
                      {question.textResponses.map((response, index) => (
                        <div
                          key={`${question.questionId}-${index}`}
                          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
                        >
                          {response}
                        </div>
                      ))}
                      {question.hasMoreResponses ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t("responseAnalyticsMoreResponses", {
                            count: Math.max(question.responseCount - question.textResponses.length, 0),
                          })}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
