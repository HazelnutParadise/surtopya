import type { Question, QuestionType } from "@/types/survey"

type DragData = Record<string, unknown>

type DragOverlayArgs = {
  activeId: string | null
  activeItem: DragData | null
  questions: Question[]
  dragOverlayWidth: number | null
}

type ToolboxOverlayState = {
  mode: "toolbox"
  width: number | null
  type: QuestionType
}

type ExistingQuestionOverlayState = {
  mode: "existing-question"
  width: number | null
  question: Question
}

type ExistingSectionOverlayState = {
  mode: "existing-section"
  width: number | null
  question: Question
  childQuestions: Question[]
}

export type DragOverlayState =
  | ToolboxOverlayState
  | ExistingQuestionOverlayState
  | ExistingSectionOverlayState
  | null

export const getDragOverlayState = ({
  activeId,
  activeItem,
  questions,
  dragOverlayWidth,
}: DragOverlayArgs): DragOverlayState => {
  if (activeItem?.isToolboxItem === true && typeof activeItem.type === "string") {
    return {
      mode: "toolbox",
      width: dragOverlayWidth,
      type: activeItem.type as QuestionType,
    }
  }

  if (!activeId) return null

  const activeQuestion = questions.find((question) => question.id === activeId)
  if (!activeQuestion) return null

  if (activeQuestion.type === "section") {
    const activeIndex = questions.findIndex((question) => question.id === activeId)
    const childQuestions: Question[] = []

    for (let index = activeIndex + 1; index < questions.length; index += 1) {
      const nextQuestion = questions[index]
      if (nextQuestion.type === "section") break
      childQuestions.push(nextQuestion)
    }

    return {
      mode: "existing-section",
      width: dragOverlayWidth,
      question: activeQuestion,
      childQuestions,
    }
  }

  return {
    mode: "existing-question",
    width: dragOverlayWidth,
    question: activeQuestion,
  }
}
