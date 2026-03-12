import type { SurveyVersion } from "@/lib/api"

type QuestionLike = {
  type?: string
}

type SurveyVersionLike = Pick<SurveyVersion, "snapshot"> | {
  snapshot?: {
    questions?: QuestionLike[]
  }
}

const countNonSectionQuestions = (questions: QuestionLike[] = []) => {
  return questions.filter((question) => question.type !== "section").length
}

export const getSurveyResponseSummaryQuestionCount = ({
  draftQuestions = [],
  surveyVersions = [],
}: {
  draftQuestions?: QuestionLike[]
  surveyVersions?: SurveyVersionLike[]
}) => {
  if (surveyVersions.length > 0) {
    return countNonSectionQuestions(surveyVersions[0]?.snapshot?.questions || [])
  }

  return countNonSectionQuestions(draftQuestions)
}

export { countNonSectionQuestions }
