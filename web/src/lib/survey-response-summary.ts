import type { SurveyVersion } from "@/lib/api"

type QuestionLike = {
  type?: string
}

type SurveyVersionLike = Pick<SurveyVersion, "snapshot" | "versionNumber"> | {
  versionNumber?: number
  snapshot?: {
    questions?: QuestionLike[]
  }
}

const countNonSectionQuestions = (questions: QuestionLike[] = []) => {
  return questions.filter((question) => question.type !== "section").length
}

export const getSurveyResponseSummaryQuestionCount = ({
  selectedVersion = "all",
  draftQuestions = [],
  surveyVersions = [],
}: {
  selectedVersion?: string
  draftQuestions?: QuestionLike[]
  surveyVersions?: SurveyVersionLike[]
}) => {
  if (selectedVersion !== "all") {
    const versionNumber = Number.parseInt(selectedVersion, 10)
    if (Number.isFinite(versionNumber)) {
      const selectedSnapshot = surveyVersions.find((version) => version.versionNumber === versionNumber)
      if (selectedSnapshot) {
        return countNonSectionQuestions(selectedSnapshot.snapshot?.questions || [])
      }
    }
  }

  if (surveyVersions.length > 0) {
    return countNonSectionQuestions(surveyVersions[0]?.snapshot?.questions || [])
  }

  return countNonSectionQuestions(draftQuestions)
}

export { countNonSectionQuestions }
