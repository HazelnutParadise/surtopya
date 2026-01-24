"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SurveyCard } from "@/components/survey-card";
import { Plus, BarChart3, Award } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { withLocale, getLocaleFromPath } from "@/lib/locale";
import { useTranslations } from "next-intl";
import type { Survey } from "@/lib/api";

export default function DashboardPage() {
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const t = useTranslations("Dashboard");

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchSurveys = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/surveys/my", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (isMounted) {
            setSurveys([]);
          }
          return;
        }
        const payload = await response.json();
        if (isMounted) {
          setSurveys(payload.surveys || []);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load surveys:", error);
          setSurveys([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSurveys();

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
    () => surveys.filter((survey) => survey.isPublished).length,
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
                  points={survey.pointsReward}
                  responses={survey.responseCount}
                  visibility={survey.visibility}
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
      </div>
    </div>
  );
}
