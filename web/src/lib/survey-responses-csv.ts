import type { QuestionOption } from "@/types/survey"

export interface CsvAnswerValueLike {
  text?: string
  value?: string
  date?: string
  rating?: number
  values?: string[]
  otherText?: string
}

export interface CsvAnswerLike {
  questionId: string
  value?: CsvAnswerValueLike
}

export interface CsvResponseLike {
  id: string
  status: string
  surveyVersionNumber?: number
  userId?: string
  anonymousId?: string
  pointsAwarded?: number
  startedAt?: string
  completedAt?: string
  createdAt?: string
  answers?: CsvAnswerLike[]
}

export interface CsvSurveyVersionLike {
  versionNumber?: number
  snapshot?: {
    questions?: Array<{
      id?: string
      title?: string
      type?: string
      options?: QuestionOption[]
    }>
  } | null
}

export interface CsvMetadataHeaders {
  id: string
  status: string
  respondent: string
  points: string
  startedAt: string
  submittedAt: string
}

export interface BuildSurveyResponsesCsvRowsOptions {
  responses: CsvResponseLike[]
  surveyVersions: CsvSurveyVersionLike[]
  metadataHeaders: CsvMetadataHeaders
  exportScope?: "all" | number
}

interface CsvQuestionColumn {
  id: string
  title: string
  hasDetailsColumn: boolean
}

const normalizeTitle = (value: string) => value.trim()

const isContentQuestion = (questionType?: string) => questionType !== "section"

const hasOtherText = (value?: CsvAnswerValueLike) =>
  typeof value?.otherText === "string" && value.otherText.trim().length > 0

const readAnswerValue = (value?: CsvAnswerValueLike) => {
  if (!value) return { primary: "", details: "" }
  const otherText = typeof value.otherText === "string" ? value.otherText.trim() : ""
  if (typeof value.text === "string" && value.text.length > 0) return { primary: value.text, details: "" }
  if (typeof value.value === "string" && value.value.length > 0) {
    return { primary: value.value, details: otherText }
  }
  if (typeof value.date === "string" && value.date.length > 0) return { primary: value.date, details: "" }
  if (typeof value.rating === "number") return { primary: String(value.rating), details: "" }
  if (Array.isArray(value.values) && value.values.length > 0) {
    return { primary: value.values.join(" | "), details: otherText }
  }
  if (otherText) return { primary: "", details: otherText }
  return { primary: "", details: "" }
}

const buildVersionQuestionColumns = (surveyVersions: CsvSurveyVersionLike[]) => {
  const sortedVersions = [...surveyVersions].sort(
    (left, right) => (left.versionNumber || 0) - (right.versionNumber || 0)
  )

  const ordered: CsvQuestionColumn[] = []
  const seen = new Set<string>()

  sortedVersions.forEach((version) => {
    const questions = version.snapshot?.questions || []
    questions.forEach((question) => {
      const questionId = question.id?.trim()
      if (!questionId || seen.has(questionId) || !isContentQuestion(question.type)) {
        return
      }

      seen.add(questionId)
      ordered.push({
        id: questionId,
        title: normalizeTitle(question.title || "") || questionId,
        hasDetailsColumn: Array.isArray(question.options)
          ? question.options.some((option) => option?.isOther === true)
          : false,
      })
    })
  })

  return ordered
}

const ensureAnswerQuestionColumns = (
  columns: CsvQuestionColumn[],
  responses: CsvResponseLike[]
) => {
  const seen = new Set(columns.map((column) => column.id))

  responses.forEach((response) => {
    ;(response.answers || []).forEach((answer) => {
      const questionId = answer.questionId?.trim()
      if (!questionId || seen.has(questionId)) {
        if (questionId && hasOtherText(answer.value)) {
          const existing = columns.find((column) => column.id === questionId)
          if (existing) existing.hasDetailsColumn = true
        }
        return
      }

      seen.add(questionId)
      columns.push({ id: questionId, title: questionId, hasDetailsColumn: hasOtherText(answer.value) })
    })
  })
}

const disambiguateTitles = (columns: CsvQuestionColumn[]) => {
  const titleCounts = new Map<string, number>()

  columns.forEach((column) => {
    const count = titleCounts.get(column.title) || 0
    titleCounts.set(column.title, count + 1)
  })

  return columns.map((column) => {
    const duplicated = (titleCounts.get(column.title) || 0) > 1
    return {
      ...column,
      title: duplicated ? `${column.title} (${column.id})` : column.title,
    }
  })
}

export const buildSurveyResponsesCsvRows = ({
  responses,
  surveyVersions,
  metadataHeaders,
  exportScope = "all",
}: BuildSurveyResponsesCsvRowsOptions) => {
  const completedResponses = responses.filter((response) => {
    if (response.status !== "completed") return false
    if (exportScope === "all") return true
    return response.surveyVersionNumber === exportScope
  })

  const scopedVersions =
    exportScope === "all"
      ? surveyVersions
      : surveyVersions.filter((version) => version.versionNumber === exportScope)

  const columns = buildVersionQuestionColumns(scopedVersions)
  ensureAnswerQuestionColumns(columns, completedResponses)
  const questionColumns = disambiguateTitles(columns)

  const headers = [
    metadataHeaders.id,
    metadataHeaders.status,
    metadataHeaders.respondent,
    metadataHeaders.points,
    metadataHeaders.startedAt,
    metadataHeaders.submittedAt,
    ...questionColumns.flatMap((column) =>
      column.hasDetailsColumn ? [column.title, `${column.title} - Details`] : [column.title]
    ),
  ]

  const rows = completedResponses.map((response) => {
    const answersByQuestionId = new Map(
      (response.answers || []).map((answer) => [answer.questionId, answer])
    )

    return [
      response.id,
      response.status,
      response.userId || response.anonymousId || "",
      String(response.pointsAwarded || 0),
      response.startedAt || "",
      response.completedAt || response.createdAt || "",
      ...questionColumns.flatMap((column) => {
        const answer = answersByQuestionId.get(column.id)
        const value = readAnswerValue(answer?.value)
        return column.hasDetailsColumn ? [value.primary, value.details] : [value.primary]
      }),
    ]
  })

  return [headers, ...rows]
}
