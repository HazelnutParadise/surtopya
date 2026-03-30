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
    exclusiveOptionToggle: "Exclusive option",
    otherTextRequiredToggle: "Require details",
    cannotDeleteFirstPage: "Cannot delete first page",
    minSelections: "Min selections",
    maxSelections: "Max selections",
    pageNavigationMode: "Page navigation",
    pageNavigationNext: "Next page",
    pageNavigationSpecific: "Specific page",
    pageNavigationEndSurvey: "Submit at end of this page",
    defaultPageJump: "Default page jump",
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
  it("uses larger title inputs for questions and section pages", () => {
    const { rerender } = render(
      <QuestionCard
        question={{
          id: "q-title",
          type: "single",
          title: "Question title",
          required: false,
          options: [{ label: "A" }],
        }}
        onUpdate={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onOpenLogic={() => {}}
      />
    )

    expect(screen.getByDisplayValue("Question title")).toHaveClass("text-xl", "min-h-12")

    rerender(
      <QuestionCard
        question={{
          id: "page-title",
          type: "section",
          title: "Page title",
          required: false,
        }}
        onUpdate={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onOpenLogic={() => {}}
      />
    )

    expect(screen.getByDisplayValue("Page title")).toHaveClass("text-2xl", "min-h-14")
  })

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

  it("shows a visible indicator when a question has logic configured", () => {
    renderCard({
      id: "q-logic",
      type: "single",
      title: "With logic",
      required: false,
      options: [{ id: "opt-a", label: "A" }],
      logic: [
        {
          operator: "or",
          conditions: [{ optionId: "opt-a", match: "includes" }],
          destinationQuestionId: "page-2",
        },
      ],
    })

    expect(screen.getByTestId("question-logic-indicator")).toBeInTheDocument()
  })

  it("shows multi-select constraint controls", () => {
    render(
      <QuestionCard
        question={{
          id: "q-multi-controls",
          type: "multi",
          title: "Choose many",
          required: false,
          minSelections: 1,
          maxSelections: 2,
          options: [{ label: "A", exclusive: true }, { label: "B" }],
        }}
        onUpdate={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onOpenLogic={() => {}}
      />
    )

    expect(screen.getAllByRole("button", { name: "Exclusive option" })).toHaveLength(2)
    expect(screen.getByDisplayValue("1")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2")).toBeInTheDocument()
  })

  it("shows page default navigation controls for sections", () => {
    render(
      <QuestionCard
        question={{
          id: "page-1",
          type: "section",
          title: "Page 1",
          required: false,
          defaultDestinationQuestionId: "page-3",
        }}
        laterSectionOptions={[{ id: "page-3", title: "Page 3" }]}
        onUpdate={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onOpenLogic={() => {}}
      />
    )

    expect(screen.getByText("Default page jump")).toBeInTheDocument()
    expect(screen.getByText("Page navigation")).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Page navigation" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next page" })).toHaveClass("text-[var(--primary-foreground)]")
    expect(screen.getByRole("button", { name: "Specific page" })).toHaveClass("bg-white", "text-gray-900")
    expect(screen.getByRole("option", { name: "Submit at end of this page" })).toBeInTheDocument()
  })

  it("disables the specific-page switcher when there are no later pages", () => {
    render(
      <QuestionCard
        question={{
          id: "page-last",
          type: "section",
          title: "Last page",
          required: false,
        }}
        laterSectionOptions={[]}
        onUpdate={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onOpenLogic={() => {}}
      />
    )

    expect(screen.getByRole("button", { name: "Specific page" })).toBeDisabled()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })

  it("does not color the logic button red for non-contradictory warnings", () => {
    render(
      <QuestionCard
        question={{
          id: "q-warning",
          type: "single",
          title: "Has destination warning",
          required: false,
          options: [{ id: "opt-a", label: "A" }],
          logic: [
            {
              operator: "or",
              conditions: [{ optionId: "opt-a", match: "includes" }],
              destinationQuestionId: "missing-page",
            },
          ],
        }}
        hasLogic
        hasLogicWarning
        logicWarningMessage="Destination is invalid"
        onUpdate={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onOpenLogic={() => {}}
      />
    )

    expect(screen.getByRole("button", { name: "Logic Jumps" })).not.toHaveClass("text-red-500")
  })
})
