"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { SurveyRenderer } from "@/components/survey/survey-renderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Award, ArrowRight, ArrowLeft, X, CheckSquare, AlignLeft, BarChart, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SurveyDisplay } from "@/lib/survey-mappers";
import { SurveyTheme } from "@/types/survey";
import { getLocaleFromPath, withLocale } from "@/lib/locale";
import { useTranslations } from "next-intl";
import { buildSubmitAnswers } from "@/lib/response-submit"

// Helper to format rich text description (simple markdown)
const RichText = ({ content }: { content: string }) => {
  if (!content) return null;

  // Simple parser: **bold**, _italic_, [link](url), - list
  // Note: For production, use a proper library like react-markdown
  const parts = content.split(/(\*\*.*?\*\*|_[^_]+_|\[.*?\]\(.*?\)|^- .*$)/gm);

  return (
    <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-gray-900 dark:text-gray-200">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('_') && part.endsWith('_')) {
          return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        }
        if (part.match(/\[(.*?)\]\((.*?)\)/)) {
          const match = part.match(/\[(.*?)\]\((.*?)\)/);
          return <a key={i} href={match![2]} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">{match![1]}</a>;
        }
        if (part.trim().startsWith('- ')) {
           return <div key={i} className="flex items-start gap-2 ml-4 my-1"><div className="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400 flex-shrink-0" /><span>{part.trim().substring(2)}</span></div>;
        }
        return part;
      })}
    </div>
  );
};

interface SurveyClientPageProps {
  initialSurvey?: SurveyDisplay;
  surveyId: string;
  isPreview?: boolean;
  surveyBasePoints: number;
}

export function SurveyClientPage({ initialSurvey, surveyId, isPreview = false, surveyBasePoints }: SurveyClientPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocaleFromPath(pathname);
  const withLocalePath = (href: string) => withLocale(href, locale);
  const t = useTranslations("SurveyPage");
  const tCard = useTranslations("SurveyCard");
  const tCommon = useTranslations("Common")
  
  const previewData = useMemo(() => {
    if (!isPreview || typeof window === "undefined") {
      return { survey: null as SurveyDisplay | null, theme: undefined as SurveyTheme | undefined }
    }
    try {
      const surveyData = sessionStorage.getItem("preview_survey")
      const themeData = sessionStorage.getItem("preview_theme")
      const parsedSurvey = surveyData ? (JSON.parse(surveyData) as SurveyDisplay) : null
      const parsedTheme = themeData ? (JSON.parse(themeData) as SurveyTheme) : undefined
      return {
        survey: parsedSurvey
          ? {
              ...parsedSurvey,
              responseCount: 0,
            }
          : null,
        theme: parsedTheme,
      }
    } catch (error) {
      console.error("Failed to load preview data:", error)
      return { survey: null as SurveyDisplay | null, theme: undefined as SurveyTheme | undefined }
    }
  }, [isPreview])

  const [survey] = useState<SurveyDisplay | null>(initialSurvey || previewData.survey || null)
  const [theme] = useState<SurveyTheme | undefined>(previewData.theme)
  const [loading] = useState(false)

  const [isTaking, setIsTaking] = useState(Boolean(previewData.survey))
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [flowError, setFlowError] = useState<string | null>(null)
  const [previewCompletePayload, setPreviewCompletePayload] = useState<string | null>(null)

  const rewardEstimate = survey
    ? surveyBasePoints + Math.floor((survey.settings.pointsReward || 0) / 3)
    : 0

  // Effect 2: Enforce title in URL for SEO (non-preview only)
  useEffect(() => {
    if (isPreview || !survey || loading || isTaking) return;

    const currentTitleParam = searchParams.get('title');
    const expectedTitleSlug = encodeURIComponent(survey.title.replace(/\s+/g, '-').toLowerCase());

    if (currentTitleParam !== expectedTitleSlug) {
      const newPath = withLocalePath(`/survey/${surveyId}?title=${expectedTitleSlug}`);
      // Use router.replace but don't depend on 'survey' itself to avoid loop
      // Only run if the title in URL is actually different
      router.replace(newPath, { scroll: false });
    }
  }, [isPreview, survey?.title, surveyId, searchParams, router, loading, isTaking]);

  const handleStartSurvey = async () => {
    setFlowError(null)
    if (isPreview) {
      setIsTaking(true)
      return
    }
    if (!survey) return

    setStarting(true)
    try {
      const response = await fetch(`/api/surveys/${surveyId}/responses/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to start response")
      }
      if (!payload?.id) {
        throw new Error("Invalid response payload")
      }
      setResponseId(String(payload.id))
      setIsTaking(true)
    } catch (error) {
      console.error("Failed to start survey:", error)
      setFlowError(tCommon("error"))
    } finally {
      setStarting(false)
    }
  }

  const handleExitClick = () => {
    if (isPreview) {
      window.close();
    } else {
      setShowExitDialog(true);
    }
  };

  const handleConfirmExit = () => {
    setShowExitDialog(false);
    setIsTaking(false);
  };

  const handleComplete = async (answers: Record<string, unknown>) => {
    setFlowError(null)
    if (!survey) return

    if (isPreview) {
      setPreviewCompletePayload(
        `${t("previewCompleteTitle")}\n\n${t("previewCompleteDescription")}\n\n${t("previewCompleteResponses")}\n` +
          JSON.stringify(answers, null, 2)
      )
      return
    }

    if (!responseId) {
      setFlowError(tCommon("error"))
      return
    }

    setSubmitting(true)
    try {
      const submitPayload = { answers: buildSubmitAnswers(survey, answers) }
      const response = await fetch(`/api/responses/${responseId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitPayload),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Submit failed")
      }

      router.push(withLocalePath("/survey/thank-you"))
    } catch (error) {
      console.error("Failed to submit response:", error)
      setFlowError(tCommon("error"))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-950 dark:to-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("notFoundTitle")}</h1>
          <p className="text-gray-500">
            {isPreview 
              ? t("notFoundPreviewDescription") 
              : t("notFoundDescription")}
          </p>
          <Button onClick={() => router.push(withLocalePath(isPreview ? "/create" : "/explore"))} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isPreview ? t("backToBuilder") : t("backToMarketplace")}
          </Button>
        </div>
      </div>
    );
  }

  // Show survey renderer when taking the survey
  if (isTaking) {
    return (
      <div className="relative">
        {/* Exit Button */}
        <div className="fixed top-4 right-4 z-[60]">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExitClick}
            className="bg-white/90 backdrop-blur shadow-lg hover:bg-white"
          >
            <X className="mr-2 h-4 w-4" />
            {isPreview ? t("exitPreview") : t("exitSurvey")}
          </Button>
        </div>

        <SurveyRenderer 
          survey={survey} 
          theme={theme}
          isPreview={isPreview}
          onComplete={handleComplete}
        />

        {flowError ? (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] w-[min(720px,calc(100vw-2rem))] rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
            {flowError}
          </div>
        ) : null}

        {/* Exit Confirmation Dialog */}
        <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
          <DialogContent onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
            <DialogTitle>{t("exitSurveyTitle")}</DialogTitle>
            <DialogDescription>
                {t("exitSurveyDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
                {t("continueSurvey")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmExit}>
                {t("exitWithoutSaving")}
            </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Question Types Summary
  const questionTypes = Array.from(new Set(survey.questions.map(q => q.type))).filter(t => t !== 'section');
  
  const getTypeDescription = (type: string) => {
      switch(type) {
          case 'single': return t('typeDescriptionSingle');
          case 'multi': return t('typeDescriptionMulti');
          case 'text': return t('typeDescriptionText');
          case 'rating': return t('typeDescriptionRating');
          case 'select': return t('typeDescriptionSelect');
          case 'date': return t('typeDescriptionDate');
          default: return t('typeDescriptionDefault');
      }
  };
  
  const getTypeIcon = (type: string) => {
       switch(type) {
          case 'single': return <CheckSquare className="w-4 h-4 text-purple-600" />;
          case 'multi': return <CheckSquare className="w-4 h-4 text-purple-600" />;
          case 'text': return <AlignLeft className="w-4 h-4 text-purple-600" />;
          case 'rating': return <BarChart className="w-4 h-4 text-purple-600" />;
          case 'date': return <Calendar className="w-4 h-4 text-purple-600" />;
          default: return <AlignLeft className="w-4 h-4 text-purple-600" />;
      }
  };

  // SEO-friendly Intro Page
  return (
    <div className="flex flex-col min-h-screen">
      {!isPreview && <Navbar />}
      
      <main className="flex-1 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        {/* Full-width hero section */}
        <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
            <div className="flex items-center gap-2 mb-6">
                <Badge className="bg-white/20 text-white border-0 hover:bg-white/30 text-sm px-3 py-1">
                  <Award className="mr-1.5 h-4 w-4" />
                {t("earnPoints", { points: rewardEstimate })}
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">{survey.title}</h1>
            {survey.creatorName && (
              <p className="text-xl text-white/80">by {survey.creatorName}</p>
            )}
          </div>
        </header>

        {/* Content section */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Main content */}
            <article className="md:col-span-2 space-y-8">
              <section>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t("aboutTitle")}</h2>
                {/* Rich Text Description */}
                <RichText content={survey.description} />
              </section>

              <section>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t("questionPreviewTitle")}</h3>
                <ul className="space-y-3 text-gray-600 dark:text-gray-400">
                  {questionTypes.length > 0 ? questionTypes.map(type => (
                      <li key={type} className="flex items-center gap-3">
                          <div className="flex-shrink-0 p-1 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                              {getTypeIcon(type)}
                          </div>
                          <span>{getTypeDescription(type)}</span>
                      </li>
                  )) : (
                      <li className="text-gray-500 italic">{t("noQuestions")}</li>
                  )}
                </ul>
              </section>

              <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t("privacyTitle")}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("privacyDescription")}
                </p>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="space-y-6">
              <Card className="border-0 shadow-xl overflow-hidden sticky top-8">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4">
                  <p className="text-white/80 text-sm">{t("rewardLabel")}</p>
                  <p className="text-3xl font-bold text-white">{t("pointsValue", { points: rewardEstimate })}</p>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t("estimatedTime")}</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {survey.estimatedMinutes
                          ? tCard("minutes", { count: survey.estimatedMinutes })
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t("responsesLabel")}</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{survey.responseCount.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>

                <div className="p-4 pt-0">
                    <Button 
                      onClick={handleStartSurvey}
                      size="lg"
                      disabled={starting}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-lg py-6 shadow-lg shadow-purple-500/25 mb-4"
                    >
                      {starting ? tCommon("loading") : t("startSurvey")}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>

                    <Button 
                      variant="ghost" 
                      onClick={() => router.push(withLocalePath("/explore"))}
                      className="w-full"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {t("backToMarketplace")}
                    </Button>
                </div>
              </Card>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
