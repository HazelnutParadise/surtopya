import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import type { Question as SurveyQuestion, QuestionType } from "@/types/survey"

type DragData = Record<string, unknown>

type DragOverlayArgs = {
  activeId: string | null
  activeItem: DragData | null
  questions: SurveyQuestion[]
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
  question: SurveyQuestion
}

type ExistingSectionOverlayState = {
  mode: "existing-section"
  width: number | null
  question: SurveyQuestion
  childQuestions: SurveyQuestion[]
}

export type DragOverlayState =
  | ToolboxOverlayState
  | ExistingQuestionOverlayState
  | ExistingSectionOverlayState
  | null

export const BUILDER_CANVAS_DROP_ID = "canvas-droppable"
export const BUILDER_CANVAS_TAIL_DROP_ID = "canvas-tail-droppable"

const isTailDropTarget = (id: string) =>
  id === BUILDER_CANVAS_DROP_ID || id === BUILDER_CANVAS_TAIL_DROP_ID

const getSectionBlockBounds = (items: SurveyQuestion[], sectionStartIndex: number) => {
  let endIndex = sectionStartIndex
  while (endIndex + 1 < items.length && items[endIndex + 1].type !== "section") {
    endIndex += 1
  }
  return { startIndex: sectionStartIndex, endIndex }
}

const moveQuestionToIndex = (items: SurveyQuestion[], oldIndex: number, newIndex: number) => {
  const nextItems = arrayMove(items, oldIndex, newIndex)
  if (nextItems[0]?.type !== "section") return items
  return nextItems
}

const moveSectionBlock = (items: SurveyQuestion[], oldIndex: number, overId: string) => {
  const { endIndex } = getSectionBlockBounds(items, oldIndex)
  const movingBlock = items.slice(oldIndex, endIndex + 1)
  const remainingItems = items.filter((_, index) => index < oldIndex || index > endIndex)

  if (isTailDropTarget(overId)) {
    return [...remainingItems, ...movingBlock]
  }

  const overIndexInRemaining = remainingItems.findIndex((item) => item.id === overId)
  if (overIndexInRemaining === -1) return items

  let targetSectionStart = overIndexInRemaining
  while (targetSectionStart >= 0 && remainingItems[targetSectionStart].type !== "section") {
    targetSectionStart -= 1
  }

  if (targetSectionStart < 0) targetSectionStart = 0

  let targetSectionEnd = targetSectionStart
  while (targetSectionEnd + 1 < remainingItems.length && remainingItems[targetSectionEnd + 1].type !== "section") {
    targetSectionEnd += 1
  }

  const overIndexInOriginal = items.findIndex((item) => item.id === overId)
  const insertIndex = oldIndex < overIndexInOriginal ? targetSectionEnd + 1 : targetSectionStart

  return [
    ...remainingItems.slice(0, insertIndex),
    ...movingBlock,
    ...remainingItems.slice(insertIndex),
  ]
}

export const builderCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args)
  if (pointerHits.length > 0) {
    const tailHit = pointerHits.find((entry) => entry.id === BUILDER_CANVAS_TAIL_DROP_ID)
    if (tailHit) return [tailHit]

    const nonCanvasHits = pointerHits.filter((entry) => entry.id !== BUILDER_CANVAS_DROP_ID)
    if (nonCanvasHits.length > 0) return nonCanvasHits

    return pointerHits
  }

  return closestCenter(args)
}

export const isBuilderDropTarget = (overId: string, items: SurveyQuestion[]) =>
  isTailDropTarget(overId) || items.some((item) => item.id === overId)

export const getToolboxPlaceholderIndex = (items: SurveyQuestion[], overId: string) => {
  if (isTailDropTarget(overId)) return items.length

  let overIndex = items.findIndex((item) => item.id === overId)
  if (overIndex === 0 && items[0]?.type === "section") {
    overIndex = 1
  }

  return overIndex === -1 ? items.length : overIndex
}

export const moveToolboxPlaceholder = (items: SurveyQuestion[], overId: string) => {
  const placeholderIndex = items.findIndex((item) => item.id === "placeholder")
  if (placeholderIndex === -1) return items

  const placeholder = items[placeholderIndex]
  return upsertToolboxPlaceholder(items, placeholder, overId)
}

export const upsertToolboxPlaceholder = (
  items: SurveyQuestion[],
  placeholder: SurveyQuestion,
  overId: string
) => {
  const firstPlaceholderIndex = items.findIndex((item) => item.id === "placeholder")
  const remainingItems = items.filter((item) => item.id !== "placeholder")
  const targetIndex =
    overId === "placeholder"
      ? firstPlaceholderIndex === -1
        ? remainingItems.length
        : Math.min(firstPlaceholderIndex, remainingItems.length)
      : getToolboxPlaceholderIndex(remainingItems, overId)

  const nextItems = [...remainingItems]
  nextItems.splice(targetIndex, 0, placeholder)

  const didChange =
    nextItems.length !== items.length ||
    nextItems.some((item, index) => item.id !== items[index]?.id)

  return didChange ? nextItems : items
}

export const reorderSurveyQuestions = (
  items: SurveyQuestion[],
  activeId: string,
  overId: string
) => {
  if (activeId === overId) return items

  const oldIndex = items.findIndex((item) => item.id === activeId)
  if (oldIndex === -1) return items

  const activeItem = items[oldIndex]
  if (activeItem.type === "section") {
    return moveSectionBlock(items, oldIndex, overId)
  }

  if (isTailDropTarget(overId)) {
    return moveQuestionToIndex(items, oldIndex, items.length - 1)
  }

  const newIndex = items.findIndex((item) => item.id === overId)
  if (newIndex === -1) return items

  return moveQuestionToIndex(items, oldIndex, newIndex)
}

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
    const childQuestions: SurveyQuestion[] = []

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
