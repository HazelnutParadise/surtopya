import type { SurveyDisplay } from "@/lib/survey-mappers"

export type SubmitAnswerValue = {
  value?: string
  values?: string[]
  text?: string
  rating?: number
  date?: string
}

export type SubmitAnswerRequest = {
  questionId: string
  value: SubmitAnswerValue
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
      if (isNonEmptyString(raw)) value.value = raw
      break
    }
    case "multi": {
      if (Array.isArray(raw)) {
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
      mapped[answer.questionId] = answer.value.value
      continue
    }
    if (Array.isArray(answer.value.values)) {
      mapped[answer.questionId] = answer.value.values
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
