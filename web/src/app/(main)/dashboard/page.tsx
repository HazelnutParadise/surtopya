import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SurveyCard } from "@/components/survey-card";
import { Plus, BarChart3, Wallet, Award } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { withLocale } from "@/lib/locale";
import { getServerTranslator } from "@/lib/i18n-server";

export default async function DashboardPage() {
  const localeCookieStore = await cookies();
  const locale = localeCookieStore.get("NEXT_LOCALE")?.value || "zh-TW";
  const t = await getServerTranslator("Dashboard");
  const mySurveys = [
    {
      id: "my-1",
      title: t("surveyCustomerTitle"),
      description: t("surveyCustomerDescription"),
      points: 25,
      duration: 5,
      responses: 156,
      rating: 4.5,
      author: { name: t("authorYou"), image: "" },
      tags: [t("tagFeedback")],
      isHot: false,
      visibility: 'public' as const,
      hasUnpublishedChanges: true,
    },
    {
      id: "my-2",
      title: t("surveyEmployeeTitle"),
      description: t("surveyEmployeeDescription"),
      points: 50,
      duration: 10,
      responses: 89,
      rating: 4.2,
      author: { name: t("authorYou"), image: "" },
      tags: [t("tagHr")],
      isHot: false,
      visibility: 'non-public' as const,
    },
    {
      id: "my-3",
      title: t("surveyProductTitle"),
      description: t("surveyProductDescription"),
      points: 30,
      duration: 3,
      responses: 245,
      rating: 4.8,
      author: { name: t("authorYou"), image: "" },
      tags: [t("tagProduct")],
      isHot: true,
      visibility: 'public' as const,
    },
  ];
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      {/* Dashboard Header */}
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
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("totalResponses")}</CardTitle>
              <BarChart3 className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-gray-500">{t("responsesDelta")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("pointsBalance")}</CardTitle>
              <Wallet className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5,600</div>
              <p className="text-xs text-gray-500">{t("pointsValue")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("activeSurveys")}</CardTitle>
              <Award className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-gray-500">{t("endingSoon")}</p>
            </CardContent>
          </Card>
        </div>

        {/* {t("mySurveys")} */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t("mySurveys")}</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mySurveys.map((survey) => (
              <SurveyCard key={survey.id} {...survey} variant="dashboard" locale={locale} />
            ))}
            
            {/* Create New Card Placeholder */}
            <Link href={withLocale("/create", locale)} className="group flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white/50 p-6 transition-all hover:border-purple-500 hover:bg-purple-50/50 dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-purple-500/50 dark:hover:bg-purple-900/20">
              <div className="mb-4 rounded-full bg-gray-100 p-4 group-hover:bg-purple-100 dark:bg-gray-800 dark:group-hover:bg-purple-900">
                <Plus className="h-6 w-6 text-gray-500 group-hover:text-purple-600 dark:text-gray-400 dark:group-hover:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400">{t("createNewSurvey")}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("startCreating")}</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
