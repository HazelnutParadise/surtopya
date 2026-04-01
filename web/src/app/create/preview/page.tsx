"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Survey, SurveyTheme } from "@/types/survey";
import { PreviewResponseReview } from "@/components/survey/preview-response-review";
import { SurveyRenderer } from "@/components/survey/survey-renderer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X } from "lucide-react";
import { getLocaleFromPath, withLocale } from "@/lib/locale";
import { useTranslations } from "next-intl";

export default function PreviewPage() {
  const tPreview = useTranslations("PreviewPage");
  const tSurveyPage = useTranslations("SurveyPage");
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const withLocalePath = (href: string) => withLocale(href, locale);
  const previewData = useMemo(() => {
    if (typeof window === "undefined") {
      return { survey: null as Survey | null, theme: null as SurveyTheme | null }
    }
    try {
      const surveyData = sessionStorage.getItem("preview_survey")
      const themeData = sessionStorage.getItem("preview_theme")
      return {
        survey: surveyData ? (JSON.parse(surveyData) as Survey) : null,
        theme: themeData ? (JSON.parse(themeData) as SurveyTheme) : null,
      }
    } catch (error) {
      console.error("Failed to load preview data:", error)
      return { survey: null as Survey | null, theme: null as SurveyTheme | null }
    }
  }, [])

  const [survey] = useState<Survey | null>(previewData.survey)
  const [theme] = useState<SurveyTheme | null>(previewData.theme)
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown> | null>(null)
  const [resultView, setResultView] = useState<"hidden" | "modal" | "full-screen">("hidden")

  const handleClose = () => {
    window.close();
  };

  const handleComplete = (answers: Record<string, unknown>) => {
    setPreviewAnswers(answers)
    setResultView("modal")
  };

  if (!survey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tPreview("noPreviewDataTitle")}</h1>
          <p className="text-gray-500">{tPreview("noPreviewDataDescription")}</p>
          <Button onClick={() => router.push(withLocalePath("/create"))} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tPreview("backToBuilder")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Exit Button */}
      <div className="fixed top-4 right-4 z-50">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleClose}
          className="bg-white/90 backdrop-blur shadow-lg hover:bg-white"
        >
          <X className="mr-2 h-4 w-4" />
          {tPreview("exitPreview")}
        </Button>
      </div>

      <SurveyRenderer 
        survey={survey} 
        theme={theme || undefined}
        isPreview={true}
        onComplete={handleComplete}
      />

      {previewAnswers && resultView === "modal" ? (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-xl bg-white dark:bg-gray-950 shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{tSurveyPage("previewResultModalTitle")}</h2>
              <Button variant="ghost" size="sm" onClick={() => setResultView("hidden")}>
                {tSurveyPage("previewResultBackToEdit")}
              </Button>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                {tSurveyPage("previewCompleteTitle")}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                {survey.completionTitle || "Thank you"}
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {survey.completionMessage || tSurveyPage("privacyDescription")}
              </p>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
              <PreviewResponseReview
                survey={survey}
                answers={previewAnswers}
                displayMode="modal"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setResultView("full-screen")}>
                {tSurveyPage("previewResultOpenFullPage")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {previewAnswers && resultView === "full-screen" ? (
        <div className="fixed inset-0 z-[75] overflow-auto bg-white dark:bg-gray-950">
          <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
            <div className="mx-auto flex max-w-5xl items-center justify-between">
              <h2 className="text-sm font-semibold">{tSurveyPage("previewResultModalTitle")}</h2>
              <Button variant="outline" onClick={() => setResultView("modal")}>
                {tSurveyPage("previewResultBackToModal")}
              </Button>
            </div>
          </div>
          <PreviewResponseReview survey={survey} answers={previewAnswers} displayMode="full-screen" />
        </div>
      ) : null}
    </div>
  );
}
