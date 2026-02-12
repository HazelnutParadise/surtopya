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

export const buildSubmitAnswers = (
  survey: SurveyDisplay,
  answers: Record<string, unknown>
): SubmitAnswerRequest[] => {
  return survey.questions
    .filter((q) => q.type !== "section")
    .map((q) => {
      const raw = answers[q.id]
      const value: SubmitAnswerValue = {}

      switch (q.type) {
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

      return {
        questionId: q.id,
        value,
      }
    })
    .filter((a) => Object.keys(a.value).length > 0)
}

