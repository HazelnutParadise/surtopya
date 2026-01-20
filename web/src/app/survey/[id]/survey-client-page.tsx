"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { MockSurveyData } from "@/lib/data";
import { SurveyTheme } from "@/types/survey";

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
  initialSurvey?: MockSurveyData;
  surveyId: string;
  isPreview?: boolean;
}

export function SurveyClientPage({ initialSurvey, surveyId, isPreview = false }: SurveyClientPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [survey, setSurvey] = useState<MockSurveyData | null>(initialSurvey || null);
  const [theme, setTheme] = useState<SurveyTheme | undefined>(undefined);
  const [loading, setLoading] = useState(!initialSurvey); // Only load if no initial data
  const [isTaking, setIsTaking] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const hasEnforcedTitle = useRef(false);

  // Effect 1: Load preview data if in preview mode
  useEffect(() => {
    if (isPreview) {
      try {
        const surveyData = sessionStorage.getItem("preview_survey");
        const themeData = sessionStorage.getItem("preview_theme");
        
        if (surveyData) {
          const parsed = JSON.parse(surveyData);
          setSurvey({
            ...parsed,
            estimatedTime: "N/A",
            responseCount: 0,
            creator: "You (Preview)",
          });
          setIsTaking(true);
        }
        if (themeData) {
          setTheme(JSON.parse(themeData));
        }
      } catch (error) {
        console.error("Failed to load preview data:", error);
      }
      setLoading(false);
    }
  }, [isPreview]); // Only run when isPreview changes (or on mount)

  // Effect 2: Enforce title in URL for SEO (non-preview only)
  useEffect(() => {
    if (isPreview || !survey || loading || isTaking) return;

    const currentTitleParam = searchParams.get('title');
    const expectedTitleSlug = encodeURIComponent(survey.title.replace(/\s+/g, '-').toLowerCase());

    if (currentTitleParam !== expectedTitleSlug) {
      const newPath = `/survey/${surveyId}?title=${expectedTitleSlug}`;
      // Use router.replace but don't depend on 'survey' itself to avoid loop
      // Only run if the title in URL is actually different
      router.replace(newPath, { scroll: false });
    }
  }, [isPreview, survey?.title, surveyId, searchParams, router, loading, isTaking]);

  const handleStartSurvey = () => {
    setIsTaking(true);
  };

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

  const handleComplete = (answers: Record<string, any>) => {
    if (isPreview) {
      alert("Preview Complete!\n\nIn a real survey, responses would be saved.\n\nResponses:\n" + JSON.stringify(answers, null, 2));
      window.close();
    } else {
      console.log("Survey responses:", answers);
      router.push("/survey/thank-you");
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Survey Not Found</h1>
          <p className="text-gray-500">
            {isPreview 
              ? "Please open preview from the survey builder." 
              : "The survey you're looking for doesn't exist or has been removed."}
          </p>
          <Button onClick={() => router.push(isPreview ? "/create" : "/explore")} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isPreview ? "Back to Builder" : "Back to Marketplace"}
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
            {isPreview ? "Exit Preview" : "Exit Survey"}
          </Button>
        </div>

        <SurveyRenderer 
          survey={survey} 
          theme={theme}
          isPreview={isPreview}
          onComplete={handleComplete}
        />

        {/* Exit Confirmation Dialog */}
        <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
          <DialogContent onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Exit Survey?</DialogTitle>
              <DialogDescription>
                Your progress will not be saved. Are you sure you want to exit?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExitDialog(false)}>
                Continue Survey
              </Button>
              <Button variant="destructive" onClick={handleConfirmExit}>
                Exit Without Saving
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
          case 'single': return 'Multiple choice single selection';
          case 'multi': return 'Multiple choice multiple selection';
          case 'text': return 'Text response';
          case 'rating': return 'Rating scale';
          case 'select': return 'Dropdown list';
          case 'date': return 'Date picker';
          default: return 'Question';
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
                Earn {survey.settings.pointsReward} Points
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">{survey.title}</h1>
            <p className="text-xl text-white/80">by {survey.creator}</p>
          </div>
        </header>

        {/* Content section */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Main content */}
            <article className="md:col-span-2 space-y-8">
              <section>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">About this Survey</h2>
                {/* Rich Text Description */}
                <RichText content={survey.description} />
              </section>

              <section>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">What You'll Be Asked</h3>
                <ul className="space-y-3 text-gray-600 dark:text-gray-400">
                  {questionTypes.length > 0 ? questionTypes.map(type => (
                      <li key={type} className="flex items-center gap-3">
                          <div className="flex-shrink-0 p-1 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                              {getTypeIcon(type)}
                          </div>
                          <span>{getTypeDescription(type)}</span>
                      </li>
                  )) : (
                      <li className="text-gray-500 italic">No questions preview available.</li>
                  )}
                </ul>
              </section>

              <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Privacy & Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your responses are anonymous and will only be used for research purposes. 
                  You can exit the survey at any time without saving your progress.
                </p>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="space-y-6">
              <Card className="border-0 shadow-xl overflow-hidden sticky top-8">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4">
                  <p className="text-white/80 text-sm">Reward</p>
                  <p className="text-3xl font-bold text-white">{survey.settings.pointsReward} Points</p>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Estimated Time</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{survey.estimatedTime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Responses</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{survey.responseCount.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>

                <div className="p-4 pt-0">
                    <Button 
                      onClick={handleStartSurvey}
                      size="lg"
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-lg py-6 shadow-lg shadow-purple-500/25 mb-4"
                    >
                      Start Survey
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>

                    <Button 
                      variant="ghost" 
                      onClick={() => router.push("/explore")}
                      className="w-full"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Marketplace
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
