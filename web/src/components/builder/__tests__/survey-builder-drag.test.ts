import { describe, expect, it } from "vitest"
import type { Question } from "@/types/survey"
import {
  BUILDER_CANVAS_DROP_ID,
  BUILDER_CANVAS_TAIL_DROP_ID,
  getDragOverlayState,
  getToolboxPlaceholderIndex,
  moveToolboxPlaceholder,
  upsertToolboxPlaceholder,
  reorderSurveyQuestions,
} from "@/components/builder/survey-builder-drag"

describe("getDragOverlayState", () => {
  it("uses the live question from the canvas instead of stale active drag data", () => {
    const questions: Question[] = [
      {
        id: "page-1",
        type: "section",
        title: "Page 1",
        required: false,
      },
      {
        id: "q-1",
        type: "short",
        title: "Fresh title",
        required: false,
      },
    ]

    const overlay = getDragOverlayState({
      activeId: "q-1",
      activeItem: {
        id: "q-1",
        type: "short",
        title: "Stale title",
      },
      questions,
      dragOverlayWidth: 432,
    })

    expect(overlay).toEqual({
      mode: "existing-question",
      width: 432,
      question: expect.objectContaining({ id: "q-1", title: "Fresh title" }),
    })
  })

  it("includes child questions when dragging a section block", () => {
    const questions: Question[] = [
      {
        id: "page-1",
        type: "section",
        title: "Page 1",
        required: false,
      },
      {
        id: "q-1",
        type: "short",
        title: "First child",
        required: false,
      },
      {
        id: "page-2",
        type: "section",
        title: "Page 2",
        required: false,
      },
    ]

    const overlay = getDragOverlayState({
      activeId: "page-1",
      activeItem: {
        id: "page-1",
        type: "section",
        title: "Page 1",
      },
      questions,
      dragOverlayWidth: 512,
    })

    expect(overlay).toEqual({
      mode: "existing-section",
      width: 512,
      question: expect.objectContaining({ id: "page-1" }),
      childQuestions: [expect.objectContaining({ id: "q-1", title: "First child" })],
    })
  })
})

describe("getToolboxPlaceholderIndex", () => {
  const questions: Question[] = [
    {
      id: "page-1",
      type: "section",
      title: "Page 1",
      required: false,
    },
    {
      id: "q-1",
      type: "short",
      title: "First question",
      required: false,
    },
  ]

  it("appends toolbox items when hovering the dedicated tail drop zone", () => {
    expect(getToolboxPlaceholderIndex(questions, BUILDER_CANVAS_TAIL_DROP_ID)).toBe(questions.length)
  })

  it("keeps non-section items from being inserted before the first section", () => {
    expect(getToolboxPlaceholderIndex(questions, "page-1")).toBe(1)
  })
})

describe("reorderSurveyQuestions", () => {
  const survey: Question[] = [
    { id: "page-1", type: "section", title: "Page 1", required: false },
    { id: "q-1", type: "short", title: "Question 1", required: false },
    { id: "q-2", type: "short", title: "Question 2", required: false },
    { id: "page-2", type: "section", title: "Page 2", required: false },
    { id: "q-3", type: "short", title: "Question 3", required: false },
  ]

  it("moves a normal question to the end when dropped on the tail zone", () => {
    expect(
      reorderSurveyQuestions(survey, "q-1", BUILDER_CANVAS_TAIL_DROP_ID).map((question) => question.id)
    ).toEqual(["page-1", "q-2", "page-2", "q-3", "q-1"])
  })

  it("moves a whole section block to the end when dropped on the tail zone", () => {
    expect(
      reorderSurveyQuestions(survey, "page-1", BUILDER_CANVAS_TAIL_DROP_ID).map((question) => question.id)
    ).toEqual(["page-2", "q-3", "page-1", "q-1", "q-2"])
  })

  it("keeps the first item as a section when a question is dropped on the canvas container", () => {
    expect(
      reorderSurveyQuestions(survey, "q-1", BUILDER_CANVAS_DROP_ID).map((question) => question.id)
    ).toEqual(["page-1", "q-2", "page-2", "q-3", "q-1"])
  })
})

describe("moveToolboxPlaceholder", () => {
  it("returns the same array when the placeholder is already at the tail target", () => {
    const questions: Question[] = [
      { id: "page-1", type: "section", title: "Page 1", required: false },
      { id: "q-1", type: "short", title: "Question 1", required: false },
      { id: "placeholder", type: "short", title: "New Question", required: false },
    ]

    expect(moveToolboxPlaceholder(questions, BUILDER_CANVAS_TAIL_DROP_ID)).toBe(questions)
    expect(moveToolboxPlaceholder(questions, BUILDER_CANVAS_DROP_ID)).toBe(questions)
  })
})

describe("upsertToolboxPlaceholder", () => {
  it("inserts a placeholder when the toolbox drag first enters the canvas", () => {
    const questions: Question[] = [
      { id: "page-1", type: "section", title: "Page 1", required: false },
      { id: "q-1", type: "short", title: "Question 1", required: false },
    ]
    const placeholder: Question = {
      id: "placeholder",
      type: "short",
      title: "New Question",
      required: false,
    }

    expect(upsertToolboxPlaceholder(questions, placeholder, "q-1").map((question) => question.id)).toEqual([
      "page-1",
      "placeholder",
      "q-1",
    ])
  })

  it("deduplicates placeholder rows when dragover fires repeatedly before re-render settles", () => {
    const placeholder: Question = {
      id: "placeholder",
      type: "short",
      title: "New Question",
      required: false,
    }
    const duplicatedQuestions: Question[] = [
      { id: "page-1", type: "section", title: "Page 1", required: false },
      { id: "placeholder", type: "short", title: "New Question", required: false },
      { id: "q-1", type: "short", title: "Question 1", required: false },
      { id: "placeholder", type: "short", title: "New Question", required: false },
    ]

    expect(
      upsertToolboxPlaceholder(duplicatedQuestions, placeholder, BUILDER_CANVAS_TAIL_DROP_ID).map(
        (question) => question.id
      )
    ).toEqual(["page-1", "q-1", "placeholder"])
  })

  it("keeps the placeholder in place when dragover reports the placeholder itself", () => {
    const placeholder: Question = {
      id: "placeholder",
      type: "short",
      title: "New Question",
      required: false,
    }
    const questions: Question[] = [
      { id: "page-1", type: "section", title: "Page 1", required: false },
      placeholder,
      { id: "q-1", type: "short", title: "Question 1", required: false },
      { id: "q-2", type: "short", title: "Question 2", required: false },
    ]

    expect(upsertToolboxPlaceholder(questions, placeholder, "placeholder")).toBe(questions)
  })
})
