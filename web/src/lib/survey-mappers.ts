import { Survey as ApiSurvey, Question as ApiQuestion } from "@/lib/api"
import { Survey as UiSurvey, Question as UiQuestion } from "@/types/survey"
import { ensureQuestionOptionIds, normalizeQuestionOptions } from "@/lib/question-options"
import { normalizeQuestionLogic } from "@/lib/survey-logic"

export type SurveyDisplay = UiSurvey & {
  responseCount: number
  hasResponded?: boolean
  estimatedMinutes?: number
  creatorName?: string
  creatorSlug?: string
  creatorAvatarUrl?: string
  author?: {
    id: string
    slug: string
    displayName: string
    avatarUrl?: string
  }
  createdAt?: string
}

const mapQuestion = (question: ApiQuestion): UiQuestion =>
  normalizeQuestionLogic({
    id: question.id,
    type: question.type as UiQuestion["type"],
    title: question.title,
    description: question.description || undefined,
    options: ensureQuestionOptionIds(normalizeQuestionOptions(question.options)),
    required: question.required,
    logic: question.logic,
    maxRating: question.maxRating,
    minSelections: question.minSelections,
    maxSelections: question.maxSelections,
    defaultDestinationQuestionId: question.defaultDestinationQuestionId,
  })

export const mapApiSurveyToUi = (survey: ApiSurvey): SurveyDisplay => {
  const questions = (survey.questions || []).map(mapQuestion)
  const questionCount = questions.filter(q => q.type !== "section").length
  const estimatedMinutes = questionCount > 0 ? Math.max(1, Math.ceil(questionCount * 0.5)) : undefined
  const publishedCount = Number.isFinite(Number(survey.publishedCount))
    ? Math.max(0, Math.floor(Number(survey.publishedCount)))
    : 0
  const currentPublishedVersionNumber = Number.isFinite(Number(survey.currentPublishedVersionNumber))
    ? Math.max(0, Math.floor(Number(survey.currentPublishedVersionNumber)))
    : undefined
  const isPublished = publishedCount > 0 || Boolean(currentPublishedVersionNumber && currentPublishedVersionNumber > 0)

  return {
    id: survey.id,
    title: survey.title,
    description: survey.description,
    completionTitle: survey.completionTitle || undefined,
    completionMessage: survey.completionMessage || undefined,
    questions,
    theme: survey.theme,
    settings: {
      isPublic: survey.visibility === "public",
      isResponseOpen: survey.isResponseOpen,
      requireLoginToRespond: Boolean(survey.requireLoginToRespond),
      visibility: survey.visibility,
      isDatasetActive: survey.includeInDatasets,
      everPublic: survey.everPublic,
      pointsReward: survey.pointsReward,
      expiresAt: survey.expiresAt || undefined,
      publishedCount,
      currentPublishedVersionNumber,
      hasUnpublishedChanges: survey.hasUnpublishedChanges,
      isPublished,
    },
    responseCount: survey.responseCount,
    hasResponded: Boolean(survey.hasResponded),
    estimatedMinutes,
    author: survey.author,
    creatorName: survey.author?.displayName,
    creatorSlug: survey.author?.slug,
    creatorAvatarUrl: survey.author?.avatarUrl,
    createdAt: survey.createdAt,
  }
}
