
import { Metadata } from "next";
import { Suspense } from "react";
import { MOCK_SURVEYS, MockSurveyData } from "@/lib/data";
import { SurveyClientPage } from "./survey-client-page";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
};

// Helper to robustly extract ID
// Supports: "1", "1-consumer-prefs", "1-typo-slug"
function getSurveyId(paramId: string): string {
  if (!paramId) return "";
  if (paramId === 'preview') return 'preview';
  
  // If exact match in DB (unlikely for "1-slug" but check anyway)
  if (MOCK_SURVEYS[paramId]) return paramId;

  // Try splitting by hyphen if using numeric/short IDs combined with slugs
  // Assuming ID is the first part
  const parts = paramId.split('-');
  if (parts.length > 0) {
      const potentialId = parts[0];
      if (MOCK_SURVEYS[potentialId]) return potentialId;
  }

  // Fallback: return original to let component handle "Not Found"
  return paramId;
}

async function getSurvey(idParam: string): Promise<MockSurveyData | null> {
  const id = getSurveyId(idParam);
  if (id === 'preview') return MOCK_SURVEYS['preview'];
  return MOCK_SURVEYS[id] || null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const survey = await getSurvey(id);

  if (!survey) {
    return {
      title: "Survey Not Found | Surtopya",
      description: "The requested survey could not be found.",
    };
  }

  const isNonPublic = survey.settings?.visibility === 'non-public';

  return {
    title: `${survey.title} | Surtopya`,
    description: survey.description,
    robots: isNonPublic ? {
      index: false,
      follow: true,
    } : undefined,
    openGraph: {
      title: survey.title,
      description: survey.description,
      type: "article",
    },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { mode } = await searchParams;
  const isPreview = id === 'preview' || mode === 'preview';
  const survey = await getSurvey(id);

  // Generate JSON-LD Structured Data
  const jsonLd = survey ? {
    "@context": "https://schema.org",
    "@type": "Survey", // Note: schema.org doesn't have a strict 'Survey' type, often 'CreativeWork' or 'Questionnaire' is used. 'Dataset' is also possible.
    "name": survey.title,
    "description": survey.description,
    "creator": {
      "@type": "Organization",
      "name": survey.creator
    },
    "interactionStatistic": {
      "@type": "InteractionCounter",
      "userInteractionCount": survey.responseCount
    },
    "dateCreated": new Date().toISOString(), // Mock
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "availability": "https://schema.org/Online"
    }
  } : null;

  return (
    <>
      {survey && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
        <SurveyClientPage 
          initialSurvey={survey || undefined} 
          surveyId={id} 
          isPreview={isPreview} 
        />
      </Suspense>
    </>
  );
}
