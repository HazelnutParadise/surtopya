import type { Question } from "@/types/survey"
import { getQuestionLogicIssues, normalizeQuestionLogic, type LogicIssue } from "@/lib/survey-logic"

export type PublishBlockingLogicEntry = {
  question: Question
  issues: LogicIssue[]
}

export const getPublishBlockingLogicEntries = (questions: Question[]): PublishBlockingLogicEntry[] => {
  const normalizedQuestions = questions.map((question) => normalizeQuestionLogic(question))

  return normalizedQuestions
    .filter((question) => question.type !== "section")
    .map((question) => ({
      question,
      issues: getQuestionLogicIssues(question, normalizedQuestions),
    }))
    .filter((entry) => entry.issues.length > 0)
}
