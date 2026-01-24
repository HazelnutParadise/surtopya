"use client";

import { useEffect, useState } from "react";
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
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const withLocalePath = (href: string) => withLocale(href, locale);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [theme, setTheme] = useState<SurveyTheme | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load survey data from sessionStorage
    try {
      const surveyData = sessionStorage.getItem("preview_survey");
      const themeData = sessionStorage.getItem("preview_theme");
      
      if (surveyData) {
        setSurvey(JSON.parse(surveyData));
      }
      if (themeData) {
        setTheme(JSON.parse(themeData));
      }
    } catch (error) {
      console.error("Failed to load preview data:", error);
    }
    setLoading(false);
  }, []);

  const handleClose = () => {
    window.close();
  };

  const handleComplete = (answers: Record<string, any>) => {
    alert(`${tSurveyPage("previewCompleteTitle")}\n\n${tSurveyPage("previewCompleteDescription")}\n\n${tSurveyPage("previewCompleteResponses")}\n` + JSON.stringify(answers, null, 2));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

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
    </div>
  );
}
