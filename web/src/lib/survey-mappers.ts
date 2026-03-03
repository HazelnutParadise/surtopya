import { Survey as ApiSurvey, Question as ApiQuestion } from "@/lib/api"
import { Survey as UiSurvey, Question as UiQuestion } from "@/types/survey"

export type SurveyDisplay = UiSurvey & {
  responseCount: number
  estimatedMinutes?: number
  creatorName?: string
  createdAt?: string
}

const mapQuestion = (question: ApiQuestion): UiQuestion => ({
  id: question.id,
  type: question.type as UiQuestion["type"],
  title: question.title,
  description: question.description || undefined,
  options: question.options,
  required: question.required,
  logic: question.logic,
  maxRating: question.maxRating,
})

export const mapApiSurveyToUi = (survey: ApiSurvey): SurveyDisplay => {
  const questions = (survey.questions || []).map(mapQuestion)
  const questionCount = questions.filter(q => q.type !== "section").length
  const estimatedMinutes = questionCount > 0 ? Math.max(1, Math.ceil(questionCount * 0.5)) : undefined

  return {
    id: survey.id,
    title: survey.title,
    description: survey.description,
    questions,
    theme: survey.theme,
    settings: {
      isPublic: survey.visibility === "public",
      isResponseOpen: survey.isResponseOpen,
      visibility: survey.visibility,
      isDatasetActive: survey.includeInDatasets,
      everPublic: survey.everPublic,
      pointsReward: survey.pointsReward,
      expiresAt: survey.expiresAt || undefined,
      publishedCount: survey.publishedCount,
      currentPublishedVersionNumber: survey.currentPublishedVersionNumber,
    },
    responseCount: survey.responseCount,
    estimatedMinutes,
    createdAt: survey.createdAt,
  }
}
