"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Survey, SurveyTheme } from "@/types/survey";
import { SurveyRenderer } from "@/components/survey/survey-renderer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X } from "lucide-react";
import { getLocaleFromPath, withLocale } from "@/lib/locale";
import { useTranslations } from "next-intl";

export default function PreviewPage() {
  const tPreview = useTranslations("PreviewPage");
  const tSurveyPage = useTranslations("SurveyPage");
  const tCommon = useTranslations("Common")
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
  const [completePayload, setCompletePayload] = useState<string | null>(null)

  const handleClose = () => {
    window.close();
  };

  const handleComplete = (answers: Record<string, unknown>) => {
    setCompletePayload(
      `${tSurveyPage("previewCompleteTitle")}\n\n${tSurveyPage("previewCompleteDescription")}\n\n${tSurveyPage("previewCompleteResponses")}\n` +
        JSON.stringify(answers, null, 2)
    )
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

      {completePayload ? (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-gray-950 shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{tSurveyPage("previewCompleteTitle")}</h2>
              <Button variant="ghost" size="sm" onClick={() => setCompletePayload(null)}>
                {tCommon("cancel")}
              </Button>
            </div>
            <pre className="max-h-[60vh] overflow-auto text-xs bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              {completePayload}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
