import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LogicEditor } from "@/components/builder/logic-editor"
import type { Question } from "@/types/survey"

const messages: Record<string, Record<string, string>> = {
  LogicEditor: {
    title: 'Logic Jumps for "{title}"',
    unsupported: "Logic jumps are only available for Single Choice and Dropdown questions.",
    empty: 'No logic rules defined. Click "Add Rule" to start.',
    ifAnswerIs: "If answer is",
    selectOption: "Select Option",
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
  { id: "page-2", type: "section", title: "Page 2", required: false },
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
})
