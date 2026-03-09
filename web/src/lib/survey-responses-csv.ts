export interface CsvAnswerValueLike {
  text?: string
  value?: string
  date?: string
  rating?: number
  values?: string[]
}

export interface CsvAnswerLike {
  questionId: string
  value?: CsvAnswerValueLike
}

export interface CsvResponseLike {
  id: string
  status: string
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
}

interface CsvQuestionColumn {
  id: string
  title: string
}

const normalizeTitle = (value: string) => value.trim()

const isContentQuestion = (questionType?: string) => questionType !== "section"

const readAnswerValue = (value?: CsvAnswerValueLike) => {
  if (!value) return ""
  if (typeof value.text === "string" && value.text.length > 0) return value.text
  if (typeof value.value === "string" && value.value.length > 0) return value.value
  if (typeof value.date === "string" && value.date.length > 0) return value.date
  if (typeof value.rating === "number") return String(value.rating)
  if (Array.isArray(value.values) && value.values.length > 0) return value.values.join(" | ")
  return ""
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
        return
      }

      seen.add(questionId)
      columns.push({ id: questionId, title: questionId })
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
}: BuildSurveyResponsesCsvRowsOptions) => {
  const completedResponses = responses.filter((response) => response.status === "completed")

  const columns = buildVersionQuestionColumns(surveyVersions)
  ensureAnswerQuestionColumns(columns, completedResponses)
  const questionColumns = disambiguateTitles(columns)

  const headers = [
    metadataHeaders.id,
    metadataHeaders.status,
    metadataHeaders.respondent,
    metadataHeaders.points,
    metadataHeaders.startedAt,
    metadataHeaders.submittedAt,
    ...questionColumns.map((column) => column.title),
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
      ...questionColumns.map((column) => {
        const answer = answersByQuestionId.get(column.id)
        return readAnswerValue(answer?.value)
      }),
    ]
  })

  return [headers, ...rows]
}
