import { Metadata } from "next";
import { Suspense } from "react";
import { SurveyClientPage } from "./survey-client-page";
import { API_BASE_URL } from "@/lib/api-server";
import { mapApiSurveyToUi, SurveyDisplay } from "@/lib/survey-mappers";
import type { Survey as ApiSurvey } from "@/lib/api";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
};

const normalizeSurveyId = (paramId: string) => {
  if (!paramId) return "";
  if (paramId === "preview") return "preview";

  const uuidMatch = paramId.match(/[0-9a-fA-F-]{36}/);
  if (uuidMatch) {
    return uuidMatch[0];
  }

  return paramId;
};

const fetchSurvey = async (paramId: string): Promise<SurveyDisplay | null> => {
  const id = normalizeSurveyId(paramId);
  if (id === "preview") return null;

  const response = await fetch(`${API_BASE_URL}/surveys/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as ApiSurvey;
  return mapApiSurveyToUi(payload);
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const survey = await fetchSurvey(id);

  if (!survey) {
    return {
      title: "Survey Not Found | Surtopya",
      description: "The requested survey could not be found.",
    };
  }

  const isNonPublic = survey.settings?.visibility === "non-public";

  return {
    title: `${survey.title} | Surtopya`,
    description: survey.description,
    robots: isNonPublic
      ? {
          index: false,
          follow: true,
        }
      : undefined,
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
  const isPreview = id === "preview" || mode === "preview";
  const survey = await fetchSurvey(id);

  const jsonLd = survey
    ? {
        "@context": "https://schema.org",
        "@type": "Survey",
        name: survey.title,
        description: survey.description,
        interactionStatistic: {
          "@type": "InteractionCounter",
          userInteractionCount: survey.responseCount,
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        }
      >
        <SurveyClientPage
          initialSurvey={survey || undefined}
          surveyId={normalizeSurveyId(id)}
          isPreview={isPreview}
        />
      </Suspense>
    </>
  );
}
