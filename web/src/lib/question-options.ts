import type { Question, QuestionOption } from "@/types/survey"

type LegacyQuestionOption = string | QuestionOption

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export const normalizeQuestionOption = (option: unknown): QuestionOption | null => {
  if (typeof option === "string") {
    return { label: option }
  }

  if (!isRecord(option)) return null
  if (typeof option.label !== "string") return null

  return {
    label: option.label,
    isOther: option.isOther === true,
  }
}

export const normalizeQuestionOptions = (options: unknown): QuestionOption[] | undefined => {
  if (!Array.isArray(options)) return undefined

  const normalized = options
    .map(normalizeQuestionOption)
    .filter((option): option is QuestionOption => option !== null)

  return normalized.length > 0 ? normalized : []
}

export const normalizeChoiceQuestionOptions = (question: Pick<Question, "type" | "options">): QuestionOption[] => {
  if (question.type !== "single" && question.type !== "multi" && question.type !== "select") {
    return []
  }

  return normalizeQuestionOptions(question.options) || []
}

export const getQuestionOptionLabel = (option: LegacyQuestionOption) => {
  return typeof option === "string" ? option : option.label
}

export const isOtherQuestionOption = (option: LegacyQuestionOption) => {
  return typeof option !== "string" && option.isOther === true
}

export const findQuestionOptionByLabel = (
  question: Pick<Question, "type" | "options">,
  label: string
): QuestionOption | null => {
  const options = normalizeChoiceQuestionOptions(question)
  return options.find((option) => option.label === label) || null
}

export const hasOtherQuestionOption = (question: Pick<Question, "type" | "options">) => {
  return normalizeChoiceQuestionOptions(question).some((option) => option.isOther)
}

export const createDefaultQuestionOptions = (labels: string[]): QuestionOption[] => {
  return labels.map((label) => ({ label }))
}
