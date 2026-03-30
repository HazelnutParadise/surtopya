import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LogicEditor } from "@/components/builder/logic-editor"
import type { Question } from "@/types/survey"

const messages: Record<string, Record<string, string>> = {
  LogicEditor: {
    title: 'Logic Jumps for "{title}"',
    unsupported: "Logic jumps are only available for choice questions.",
    empty: 'No logic rules defined. Click "Add Rule" to start.',
    ifAnswerIs: "If answer is",
    selectOption: "Select Option",
    ratingComparator: "Compare rating",
    dateComparator: "Compare date",
    comparatorLessThan: "Less than",
    comparatorGreaterThan: "Greater than",
    comparatorEarlierThan: "Earlier than",
    comparatorLaterThan: "Later than",
    comparatorBetween: "Between",
    comparatorNotBetween: "Not between",
    valueLabel: "Value",
    startValueLabel: "Start",
    endValueLabel: "End",
    rangeInclusiveHintRating: "Between 3 and 5 includes both 3 and 5.",
    rangeInclusiveHintDate: "Between 2026-04-01 and 2026-04-10 includes both dates.",
    jumpTo: "Jump to",
    invalidDeleted: "(Deleted)",
    invalidPosition: "(Invalid position)",
    untitledQuestion: "Untitled Question",
    deletedQuestion: "Deleted Question",
    endSurvey: "Submit Survey (End)",
    currentPage: "Current Page",
    goToPage: "Go to Page",
    untitledPage: "Untitled Page",
    invalidTitle: "Logic jump is invalid: {reason}",
    addRule: "Add Logic Rule",
    addCondition: "Add condition",
    cancel: "Cancel",
    conditionMatch: "Condition",
    conditionIncludes: "Contains",
    conditionExcludes: "Does not contain",
    contradictoryConditions: "This rule contains contradictory conditions.",
    operator: "Match",
    operatorAnd: "All conditions",
    operatorOr: "Any condition",
    save: "Save Logic",
    precedenceHint: "If multiple logic jumps match on the same page, the later matched rule overrides earlier jumps.",
  },
}

const formatMessage = (template: string, values?: Record<string, string | number>) => {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string | number>) =>
    formatMessage(messages[namespace]?.[key] ?? key, values),
}))

const baseQuestions: Question[] = [
  { id: "page-1", type: "section", title: "Page 1", required: false },
  {
    id: "q1",
    type: "multi",
    title: "Select many",
    required: false,
    options: [{ id: "opt-a", label: "A" }, { id: "opt-b", label: "B" }],
    logic: [],
  },
  {
    id: "q-rating",
    type: "rating",
    title: "Rate us",
    required: false,
    maxRating: 5,
    logic: [],
  },
  {
    id: "q-date",
    type: "date",
    title: "Pick a date",
    required: false,
    logic: [],
  },
  { id: "page-2", type: "section", title: "Page 2", required: false },
  { id: "page-3", type: "section", title: "Page 3", required: false },
]

describe("LogicEditor", () => {
  it("supports multi-select questions and explains precedence", () => {
    render(
      <LogicEditor
        question={baseQuestions[1]}
        allQuestions={baseQuestions}
        open
        onOpenChange={() => {}}
        onSave={() => {}}
      />
    )

    expect(screen.queryByText(messages.LogicEditor.unsupported)).not.toBeInTheDocument()
    expect(screen.getByText(messages.LogicEditor.precedenceHint)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: messages.LogicEditor.save })).toBeEnabled()
  })

  it("shows multi-select operator and condition controls", () => {
    render(
      <LogicEditor
        question={{
          ...baseQuestions[1],
          logic: [
            {
              operator: "and",
              conditions: [{ optionId: "opt-a", match: "includes" }],
              destinationQuestionId: "page-2",
            },
          ],
        }}
        allQuestions={baseQuestions}
        open
        onOpenChange={() => {}}
        onSave={() => {}}
      />
    )

    expect(screen.getByText(messages.LogicEditor.operator)).toBeInTheDocument()
    expect(screen.getByText(messages.LogicEditor.conditionMatch)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: messages.LogicEditor.addCondition })).toBeInTheDocument()
  })

  it("shows rating comparator controls and inclusive boundary hint", () => {
    render(
      <LogicEditor
        question={{
          ...baseQuestions[2],
          logic: [
            {
              conditions: [
                {
                  kind: "scalar",
                  comparator: "between",
                  value: "3",
                  secondaryValue: "5",
                },
              ],
              destinationQuestionId: "page-2",
            },
          ],
        }}
        allQuestions={baseQuestions}
        open
        onOpenChange={() => {}}
        onSave={() => {}}
      />
    )

    expect(screen.getByText(messages.LogicEditor.ratingComparator)).toBeInTheDocument()
    expect(screen.getByText(messages.LogicEditor.rangeInclusiveHintRating)).toBeInTheDocument()
    expect(screen.getByText(messages.LogicEditor.startValueLabel)).toBeInTheDocument()
    expect(screen.getByText(messages.LogicEditor.endValueLabel)).toBeInTheDocument()
  })

  it("shows date comparator controls and inclusive boundary hint", () => {
    render(
      <LogicEditor
        question={{
          ...baseQuestions[3],
          logic: [
            {
              conditions: [
                {
                  kind: "scalar",
                  comparator: "between",
                  value: "2026-04-01",
                  secondaryValue: "2026-04-10",
                },
              ],
              destinationQuestionId: "page-2",
            },
          ],
        }}
        allQuestions={baseQuestions}
        open
        onOpenChange={() => {}}
        onSave={() => {}}
      />
    )

    expect(screen.getByText(messages.LogicEditor.dateComparator)).toBeInTheDocument()
    expect(screen.getByText(messages.LogicEditor.rangeInclusiveHintDate)).toBeInTheDocument()
    expect(screen.getByText(messages.LogicEditor.startValueLabel)).toBeInTheDocument()
    expect(screen.getByText(messages.LogicEditor.endValueLabel)).toBeInTheDocument()
  })

  it("only offers later pages and end survey as destinations", () => {
    render(
      <LogicEditor
        question={{
          ...baseQuestions[1],
          logic: [
            {
              operator: "or",
              conditions: [{ optionId: "opt-a", match: "includes" }],
              destinationQuestionId: "page-2",
            },
          ],
        }}
        allQuestions={baseQuestions}
        open
        onOpenChange={() => {}}
        onSave={() => {}}
      />
    )

    fireEvent.click(screen.getAllByRole("combobox").at(-1) as HTMLElement)

    expect(screen.getByText(messages.LogicEditor.endSurvey)).toBeInTheDocument()
    expect(screen.getAllByText("Page 2").length).toBeGreaterThan(0)
    expect(screen.getByText("Page 3")).toBeInTheDocument()
    expect(screen.queryByText(messages.LogicEditor.currentPage)).not.toBeInTheDocument()
  })
})
