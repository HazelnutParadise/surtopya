"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SurveyCard } from "@/components/survey-card";
import { Plus, BarChart3, Award, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { withLocale, getLocaleFromPath } from "@/lib/locale";
import { useTimeZone, useTranslations } from "next-intl";
import type { CompletedResponseSummary, ResponseDraftSummary, Survey } from "@/lib/api";
import { getRuntimeConfig } from "@/lib/runtime-config"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatUtcDateTime } from "@/lib/date-time";

export default function DashboardPage() {
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const timeZone = useTimeZone()
  const t = useTranslations("Dashboard");

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [drafts, setDrafts] = useState<ResponseDraftSummary[]>([])
  const [completedResponses, setCompletedResponses] = useState<CompletedResponseSummary[]>([])
  const [loading, setLoading] = useState(true);
  const [surveyBasePoints, setSurveyBasePoints] = useState(0)

  useEffect(() => {
    let alive = true
    getRuntimeConfig()
      .then((cfg) => {
        if (alive) setSurveyBasePoints(cfg.surveyBasePoints)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [surveysResponse, draftsResponse, completedResponse] = await Promise.all([
          fetch("/api/app/surveys/my", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/app/drafts/my", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/app/responses/my", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ])

        const surveysPayload = surveysResponse.ok ? await surveysResponse.json() : { surveys: [] }
        const draftsPayload = draftsResponse.ok ? await draftsResponse.json() : { drafts: [] }
        const completedPayload = completedResponse.ok ? await completedResponse.json() : { responses: [] }

        if (isMounted) {
          setSurveys(surveysPayload.surveys || [])
          setDrafts((draftsPayload.drafts || []).filter((item: ResponseDraftSummary) => item.canResume))
          setCompletedResponses(completedPayload.responses || [])
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load surveys:", error);
          setSurveys([])
          setDrafts([])
          setCompletedResponses([])
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const totalResponses = useMemo(
    () => surveys.reduce((sum, survey) => sum + survey.responseCount, 0),
    [surveys]
  );
  const activeSurveys = useMemo(
    () =>
      surveys.filter((survey) => {
        if (!survey.isResponseOpen) return false
        if (!survey.currentPublishedVersionNumber || survey.currentPublishedVersionNumber < 1) return false
        return true
      }).length,
    [surveys]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      <div className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div className="container px-4 py-8 md:px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
              <p className="text-gray-500 dark:text-gray-400">{t("welcomeBack")}</p>
            </div>
            <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white">
              <Link href={withLocale("/create", locale)}>
                <Plus className="mr-2 h-4 w-4" /> {t("createNewSurvey")}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container px-4 py-8 md:px-6 space-y-8">
        <Tabs defaultValue="created" className="space-y-6">
          <TabsList>
            <TabsTrigger value="created">{t("createdTab")}</TabsTrigger>
            <TabsTrigger value="responded">{t("respondedTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="space-y-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("totalResponses")}</CardTitle>
                  <BarChart3 className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalResponses.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("activeSurveys")}</CardTitle>
                  <Award className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeSurveys}</div>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t("mySurveys")}</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {!loading &&
                  surveys.map((survey) => (
                    <SurveyCard
                      key={survey.id}
                      id={survey.id}
                      title={survey.title}
                      description={survey.description}
                      author={
                        survey.author
                          ? {
                              name: survey.author.displayName,
                              image: survey.author.avatarUrl,
                              slug: survey.author.slug,
                            }
                          : undefined
                      }
                      points={surveyBasePoints + Math.floor((survey.pointsReward || 0) / 3)}
                      responses={survey.responseCount}
                      visibility={survey.visibility}
                      hasUnpublishedChanges={survey.hasUnpublishedChanges}
                      currentPublishedVersionNumber={survey.currentPublishedVersionNumber}
                      isResponseOpen={survey.isResponseOpen}
                      requireLoginToRespond={Boolean(survey.requireLoginToRespond)}
                      variant="dashboard"
                      locale={locale}
                    />
                  ))}

                {!loading && surveys.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-8">{t("noSurveys")}</div>
                )}

                <Link
                  href={withLocale("/create", locale)}
                  className="group flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white/50 p-6 transition-all hover:border-purple-500 hover:bg-purple-50/50 dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-purple-500/50 dark:hover:bg-purple-900/20"
                >
                  <div className="mb-4 rounded-full bg-gray-100 p-4 group-hover:bg-purple-100 dark:bg-gray-800 dark:group-hover:bg-purple-900">
                    <Plus className="h-6 w-6 text-gray-500 group-hover:text-purple-600 dark:text-gray-400 dark:group-hover:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400">
                    {t("createNewSurvey")}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("startCreating")}</p>
                </Link>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="responded">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t("unfinishedDraftsTitle")}</h2>
                <Card>
                  <CardContent className="p-5">
                    {drafts.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t("noUnfinishedDrafts")}</p>
                    ) : (
                      <div className="space-y-3">
                        {drafts.map((draft) => (
                          <div
                            key={draft.id}
                            className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                          >
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{draft.surveyTitle}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t("updatedAtLabel", {
                                  time: formatUtcDateTime(draft.updatedAt, { locale, timeZone }),
                                })}
                              </p>
                            </div>
                            <Button asChild variant="outline" size="sm">
                              <Link href={withLocale(`/survey/${draft.surveyId}`, locale)}>{t("resumeDraft")}</Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t("completedSurveysTitle")}</h2>
                <Card>
                  <CardContent className="p-5">
                    {completedResponses.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t("noCompletedSurveys")}</p>
                    ) : (
                      <div className="space-y-3">
                        {completedResponses.map((resp) => (
                          <div
                            key={resp.id}
                            className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                          >
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{resp.surveyTitle}</p>
                                {resp.completedAt && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {t("completedAtLabel", {
                                      time: formatUtcDateTime(resp.completedAt, { locale, timeZone }),
                                    })}
                                  </p>
                                )}
                              </div>
                            </div>
                            {resp.pointsAwarded > 0 && (
                              <span className="text-xs font-medium text-purple-600 dark:text-purple-400 shrink-0">
                                +{resp.pointsAwarded} {t("pointsUnit")}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
