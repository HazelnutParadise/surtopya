import type { SurveyDisplay } from "@/lib/survey-mappers"
import {
  normalizeMultiSelectAnswer,
  normalizeSingleSelectAnswer,
} from "@/lib/survey-answer-state"

export type SubmitAnswerValue = {
  value?: string
  values?: string[]
  text?: string
  rating?: number
  date?: string
  otherText?: string
}

export type SubmitAnswerRequest = {
  questionId: string
  value: SubmitAnswerValue
}

export type MergeSource = "guest" | "draft"

export type DraftGuestMergeAnalysis = {
  mergedNonConflictingAnswers: Record<string, unknown>
  conflictQuestionIds: string[]
}

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0
}

const toSubmitAnswerValue = (
  questionType: SurveyDisplay["questions"][number]["type"],
  raw: unknown
): SubmitAnswerValue | null => {
  const value: SubmitAnswerValue = {}

  switch (questionType) {
    case "single":
    case "select": {
      const choice = normalizeSingleSelectAnswer(raw)
      if (choice?.value) {
        value.value = choice.value
        if (isNonEmptyString(choice.otherText)) value.otherText = choice.otherText
      } else if (isNonEmptyString(raw)) {
        value.value = raw
      }
      break
    }
    case "multi": {
      const choice = normalizeMultiSelectAnswer(raw)
      if (choice?.values?.length) {
        value.values = choice.values
        if (isNonEmptyString(choice.otherText)) value.otherText = choice.otherText
      } else if (Array.isArray(raw)) {
        const values = raw.filter(isNonEmptyString)
        if (values.length > 0) value.values = values
      }
      break
    }
    case "text":
    case "short":
    case "long": {
      if (isNonEmptyString(raw)) value.text = raw
      break
    }
    case "rating": {
      if (typeof raw === "number" && Number.isFinite(raw)) {
        value.rating = raw
      } else if (isNonEmptyString(raw)) {
        const parsed = Number.parseInt(raw, 10)
        if (Number.isFinite(parsed)) value.rating = parsed
      }
      break
    }
    case "date": {
      if (isNonEmptyString(raw)) value.date = raw
      break
    }
    default:
      break
  }

  return Object.keys(value).length > 0 ? value : null
}

const getQuestionType = (
  survey: SurveyDisplay,
  questionId: string
): SurveyDisplay["questions"][number]["type"] | null => {
  const question = survey.questions.find((q) => q.id === questionId && q.type !== "section")
  return question?.type ?? null
}

const normalizeAnswerValueForCompare = (value: SubmitAnswerValue): SubmitAnswerValue => {
  return {
    ...value,
    otherText: typeof value.otherText === "string" ? value.otherText.trim() : value.otherText,
    values: Array.isArray(value.values) ? [...value.values].sort((a, b) => a.localeCompare(b)) : value.values,
  }
}

const areAnswerValuesEqual = (
  left: SubmitAnswerValue | null,
  right: SubmitAnswerValue | null
): boolean => {
  if (!left && !right) return true
  if (!left || !right) return false

  const leftNormalized = normalizeAnswerValueForCompare(left)
  const rightNormalized = normalizeAnswerValueForCompare(right)
  return JSON.stringify(leftNormalized) === JSON.stringify(rightNormalized)
}

export const analyzeDraftGuestMerge = (
  survey: SurveyDisplay,
  draftAnswers: Record<string, unknown>,
  guestAnswers: Record<string, unknown>
): DraftGuestMergeAnalysis => {
  const mergedNonConflictingAnswers: Record<string, unknown> = {}
  const conflictQuestionIds: string[] = []
  const questionIds = new Set([...Object.keys(draftAnswers), ...Object.keys(guestAnswers)])

  for (const questionId of questionIds) {
    const questionType = getQuestionType(survey, questionId)
    if (!questionType) continue

    const draftRaw = draftAnswers[questionId]
    const guestRaw = guestAnswers[questionId]
    const draftValue = toSubmitAnswerValue(questionType, draftRaw)
    const guestValue = toSubmitAnswerValue(questionType, guestRaw)

    if (!draftValue && !guestValue) continue
    if (!draftValue && guestValue) {
      mergedNonConflictingAnswers[questionId] = guestRaw
      continue
    }
    if (draftValue && !guestValue) {
      mergedNonConflictingAnswers[questionId] = draftRaw
      continue
    }

    if (areAnswerValuesEqual(draftValue, guestValue)) {
      mergedNonConflictingAnswers[questionId] = draftRaw
      continue
    }

    conflictQuestionIds.push(questionId)
  }

  return {
    mergedNonConflictingAnswers,
    conflictQuestionIds,
  }
}

export const resolveDraftGuestMerge = (
  survey: SurveyDisplay,
  draftAnswers: Record<string, unknown>,
  guestAnswers: Record<string, unknown>,
  mergeSource: MergeSource
): Record<string, unknown> => {
  const analysis = analyzeDraftGuestMerge(survey, draftAnswers, guestAnswers)
  const resolved: Record<string, unknown> = {
    ...analysis.mergedNonConflictingAnswers,
  }

  for (const questionId of analysis.conflictQuestionIds) {
    const chosenRaw = mergeSource === "guest" ? guestAnswers[questionId] : draftAnswers[questionId]
    if (chosenRaw !== undefined) {
      resolved[questionId] = chosenRaw
    }
  }

  return resolved
}

export const buildSubmitAnswers = (
  survey: SurveyDisplay,
  answers: Record<string, unknown>
): SubmitAnswerRequest[] => {
  return survey.questions
    .filter((q) => q.type !== "section")
    .map((q) => {
      const raw = answers[q.id]
      const value = toSubmitAnswerValue(q.type, raw)
      return {
        questionId: q.id,
        value: value ?? {},
      }
    })
    .filter((a) => Object.keys(a.value).length > 0)
}

export const buildSingleSubmitAnswer = (
  survey: SurveyDisplay,
  questionId: string,
  raw: unknown
): SubmitAnswerRequest | null => {
  const question = survey.questions.find((q) => q.id === questionId)
  if (!question || question.type === "section") {
    return null
  }

  const value = toSubmitAnswerValue(question.type, raw)
  if (!value) {
    return null
  }

  return {
    questionId,
    value,
  }
}

type PersistedAnswer = {
  questionId: string
  value?: SubmitAnswerValue
}

export const toRendererAnswers = (answers: PersistedAnswer[] | undefined): Record<string, unknown> => {
  if (!answers || answers.length === 0) return {}

  const mapped: Record<string, unknown> = {}
  for (const answer of answers) {
    if (!answer?.questionId || !answer.value) continue
    if (typeof answer.value.value === "string") {
      mapped[answer.questionId] =
        typeof answer.value.otherText === "string" && answer.value.otherText.trim().length > 0
          ? { value: answer.value.value, otherText: answer.value.otherText }
          : answer.value.value
      continue
    }
    if (Array.isArray(answer.value.values)) {
      mapped[answer.questionId] =
        typeof answer.value.otherText === "string" && answer.value.otherText.trim().length > 0
          ? { values: answer.value.values, otherText: answer.value.otherText }
          : answer.value.values
      continue
    }
    if (typeof answer.value.text === "string") {
      mapped[answer.questionId] = answer.value.text
      continue
    }
    if (typeof answer.value.rating === "number") {
      mapped[answer.questionId] = answer.value.rating
      continue
    }
    if (typeof answer.value.date === "string") {
      mapped[answer.questionId] = answer.value.date
    }
  }

  return mapped
}
