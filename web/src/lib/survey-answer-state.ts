import type { Question } from "@/types/survey"
import { findQuestionOptionByLabel } from "@/lib/question-options"

type RecordLike = Record<string, unknown>

export type SingleSelectAnswer = {
  value: string
  otherText?: string
}

export type MultiSelectAnswer = {
  values: string[]
  otherText?: string
}

const isRecord = (value: unknown): value is RecordLike => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const normalizeText = (value: unknown) => {
  return typeof value === "string" ? value : ""
}

const trimToUndefined = (value: string | undefined) => {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const normalizeSingleSelectAnswer = (raw: unknown): SingleSelectAnswer | null => {
  if (typeof raw === "string") {
    const trimmed = trimToUndefined(raw)
    return trimmed ? { value: trimmed } : null
  }

  if (!isRecord(raw)) return null
  const value = trimToUndefined(normalizeText(raw.value))
  if (!value) return null

  return {
    value,
    otherText: trimToUndefined(normalizeText(raw.otherText)),
  }
}

export const normalizeMultiSelectAnswer = (raw: unknown): MultiSelectAnswer | null => {
  if (Array.isArray(raw)) {
    const values = raw.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    return values.length > 0 ? { values } : null
  }

  if (!isRecord(raw)) return null
  const rawValues = Array.isArray(raw.values) ? raw.values : []
  const values = rawValues.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
  if (values.length === 0) return null

  return {
    values,
    otherText: trimToUndefined(normalizeText(raw.otherText)),
  }
}

export const normalizeQuestionAnswer = (question: Question, raw: unknown): unknown => {
  switch (question.type) {
    case "single":
    case "select":
      return normalizeSingleSelectAnswer(raw)
    case "multi":
      return normalizeMultiSelectAnswer(raw)
    default:
      return raw
  }
}

export const normalizeSurveyAnswerMap = (
  survey: Pick<QuestionContainer, "questions">,
  answers: Record<string, unknown>
): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {}

  for (const question of survey.questions) {
    if (question.type === "section") continue
    if (!(question.id in answers)) continue

    const nextValue = normalizeQuestionAnswer(question, answers[question.id])
    if (nextValue == null) continue
    normalized[question.id] = nextValue
  }

  return normalized
}

type QuestionContainer = {
  questions: Question[]
}

export const getSingleAnswerValue = (raw: unknown) => {
  return normalizeSingleSelectAnswer(raw)?.value ?? ""
}

export const getMultiAnswerValues = (raw: unknown) => {
  return normalizeMultiSelectAnswer(raw)?.values ?? []
}

export const getAnswerOtherText = (raw: unknown) => {
  if (isRecord(raw) && typeof raw.otherText === "string") {
    return raw.otherText
  }
  return ""
}

const clearOtherTextIfNeeded = (question: Question, selectedValue: string, otherText?: string) => {
  const selectedOption = findQuestionOptionByLabel(question, selectedValue)
  return selectedOption?.isOther ? otherText : undefined
}

export const setSingleAnswerValue = (question: Question, currentRaw: unknown, value: string): SingleSelectAnswer => {
  const current = normalizeSingleSelectAnswer(currentRaw)
  return {
    value,
    otherText: clearOtherTextIfNeeded(question, value, current?.otherText),
  }
}

export const setMultiAnswerValues = (question: Question, currentRaw: unknown, values: string[]): MultiSelectAnswer => {
  const current = normalizeMultiSelectAnswer(currentRaw)
  const retainsOther = values.some((value) => findQuestionOptionByLabel(question, value)?.isOther)

  return {
    values,
    otherText: retainsOther ? current?.otherText : undefined,
  }
}

export const setAnswerOtherText = (question: Question, currentRaw: unknown, otherText: string): unknown => {
  if (question.type === "single" || question.type === "select") {
    const current = normalizeSingleSelectAnswer(currentRaw)
    if (!current) return null
    return {
      value: current.value,
      otherText,
    } satisfies SingleSelectAnswer
  }

  if (question.type === "multi") {
    const current = normalizeMultiSelectAnswer(currentRaw)
    if (!current) return null
    return {
      values: current.values,
      otherText,
    } satisfies MultiSelectAnswer
  }

  return currentRaw
}

export const isQuestionAnswered = (question: Question, raw: unknown) => {
  switch (question.type) {
    case "single":
    case "select": {
      const answer = normalizeSingleSelectAnswer(raw)
      if (!answer) return false
      const selectedOption = findQuestionOptionByLabel(question, answer.value)
      if (selectedOption?.isOther) {
        return Boolean(trimToUndefined(answer.otherText))
      }
      return true
    }
    case "multi": {
      const answer = normalizeMultiSelectAnswer(raw)
      if (!answer || answer.values.length === 0) return false
      const selectedOther = answer.values.some((value) => findQuestionOptionByLabel(question, value)?.isOther)
      if (selectedOther) {
        return Boolean(trimToUndefined(answer.otherText))
      }
      return true
    }
    case "text":
    case "short":
    case "long":
      return Boolean(trimToUndefined(typeof raw === "string" ? raw : ""))
    case "rating":
      return typeof raw === "number" && Number.isFinite(raw)
    case "date":
      return Boolean(trimToUndefined(typeof raw === "string" ? raw : ""))
    default:
      return false
  }
}

export const hasSelectedOtherOption = (question: Question, raw: unknown) => {
  if (question.type === "single" || question.type === "select") {
    const answer = normalizeSingleSelectAnswer(raw)
    if (!answer) return false
    return Boolean(findQuestionOptionByLabel(question, answer.value)?.isOther)
  }

  if (question.type === "multi") {
    return getMultiAnswerValues(raw).some((value) => findQuestionOptionByLabel(question, value)?.isOther)
  }

  return false
}
