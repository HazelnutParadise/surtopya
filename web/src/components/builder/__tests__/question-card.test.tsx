import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { QuestionCard } from "@/components/builder/question-card"
import type { Question } from "@/types/survey"

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}))

const messages: Record<string, Record<string, string>> = {
  SurveyBuilder: {
    logicJumps: "Logic Jumps",
    duplicate: "Duplicate",
    delete: "Delete",
    required: "Required",
    addOption: "Add Option",
    moveUp: "Move up",
    moveDown: "Move down",
    otherOptionToggle: "Other",
    otherTextRequiredToggle: "Require details",
    cannotDeleteFirstPage: "Cannot delete first page",
  },
  QuestionTypes: {
    single: "Single choice",
    multi: "Multiple choice",
    section: "Page",
  },
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => messages[namespace]?.[key] ?? key,
}))

const renderCard = (question: Question) => {
  const onOpenLogic = vi.fn()
  render(
    <QuestionCard
      question={question}
      onUpdate={() => {}}
      onDelete={() => {}}
      onDuplicate={() => {}}
      onOpenLogic={onOpenLogic}
    />
  )
  return { onOpenLogic }
}

describe("QuestionCard", () => {
  it("shows logic-jump controls for multi-select questions", () => {
    const { onOpenLogic } = renderCard({
      id: "q-multi",
      type: "multi",
      title: "Select many",
      required: false,
      options: [{ label: "A" }, { label: "B" }],
    })

    fireEvent.click(screen.getByRole("button", { name: "Logic Jumps" }))
    expect(onOpenLogic).toHaveBeenCalledWith("q-multi")
  })

  it("renders distinct markers for single and multi choice options", () => {
    const { rerender } = render(
      <QuestionCard
        question={{
          id: "q-single",
          type: "single",
          title: "Pick one",
          required: false,
          options: [{ label: "A" }],
        }}
        onUpdate={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onOpenLogic={() => {}}
      />
    )

    expect(screen.getByTestId("question-choice-marker-single")).toBeInTheDocument()
    expect(screen.queryByTestId("question-choice-marker-multi")).not.toBeInTheDocument()

    rerender(
      <QuestionCard
        question={{
          id: "q-multi-2",
          type: "multi",
          title: "Pick many",
          required: false,
          options: [{ label: "A" }],
        }}
        onUpdate={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onOpenLogic={() => {}}
      />
    )

    expect(screen.getByTestId("question-choice-marker-multi")).toBeInTheDocument()
    expect(screen.queryByTestId("question-choice-marker-single")).not.toBeInTheDocument()
  })
})
