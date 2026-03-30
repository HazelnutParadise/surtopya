import { describe, expect, it } from "vitest"
import type { Question } from "@/types/survey"
import { getDragOverlayState } from "@/components/builder/survey-builder-drag"

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
