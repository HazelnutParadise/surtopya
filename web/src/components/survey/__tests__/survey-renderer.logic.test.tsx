import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SurveyRenderer } from "@/components/survey/survey-renderer"
import type { Survey } from "@/types/survey"

const messages: Record<string, Record<string, string>> = {
  SurveyRenderer: {
    requiredAlert: "Please complete required questions.",
    otherTextRequiredAlert: 'Please add details for "{question}".',
    otherTextRequiredHint: "Please fill in the details before continuing.",
    previewBanner: "Preview mode",
    pageProgress: "Page {current} / {total}",
    percentComplete: "{percent}%",
    requiredLabel: "Required",
    textPlaceholder: "Type here",
    selectPlaceholder: "Select one",
    back: "Back",
    submit: "Submit",
    next: "Next",
    otherTextPlaceholder: "Please specify",
  },
  QuestionTypes: {
    single: "Single choice",
    multi: "Multiple choice",
    text: "Text",
    short: "Short answer",
    long: "Long answer",
    rating: "Rating",
    date: "Date",
    select: "Select",
    section: "Page",
  },
}

const formatMessage = (template: string, values?: Record<string, string | number>) => {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/en/survey/preview",
}))

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string | number>) =>
    formatMessage(messages[namespace]?.[key] ?? key, values),
}))

const createSurvey = (questions: Survey["questions"]): Survey =>
  ({
    id: "survey-logic",
    title: "Logic survey",
    description: "",
    questions,
    settings: {
      isPublic: true,
      isResponseOpen: true,
      requireLoginToRespond: false,
      visibility: "public",
      isDatasetActive: true,
      pointsReward: 0,
    },
  }) as Survey

describe("SurveyRenderer logic precedence", () => {
  it("supports multi-select logic and uses the last matched rule within the question", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          { id: "page-1", type: "section", title: "Page 1", required: false },
          {
            id: "q1",
            type: "multi",
            title: "Choose options",
            required: true,
            options: [{ label: "A" }, { label: "B" }],
            logic: [
              { triggerOption: "A", destinationQuestionId: "page-2" },
              { triggerOption: "B", destinationQuestionId: "page-3" },
            ],
          },
          { id: "page-2", type: "section", title: "Page 2", required: false },
          { id: "q2", type: "short", title: "Question on page 2", required: false },
          { id: "page-3", type: "section", title: "Page 3", required: false },
          { id: "q3", type: "short", title: "Question on page 3", required: false },
        ])}
      />
    )

    fireEvent.click(screen.getByText("A"))
    fireEvent.click(screen.getByText("B"))
    fireEvent.click(screen.getByRole("button", { name: /next/i }))

    expect(screen.getByText("Question on page 3")).toBeInTheDocument()
    expect(screen.queryByText("Question on page 2")).not.toBeInTheDocument()
  })

  it("uses the last matched rule across the current page when multiple questions match", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          { id: "page-1", type: "section", title: "Page 1", required: false },
          {
            id: "q1",
            type: "single",
            title: "First question",
            required: true,
            options: [{ label: "A" }],
            logic: [{ triggerOption: "A", destinationQuestionId: "page-2" }],
          },
          {
            id: "q2",
            type: "single",
            title: "Second question",
            required: true,
            options: [{ label: "B" }],
            logic: [{ triggerOption: "B", destinationQuestionId: "page-3" }],
          },
          { id: "page-2", type: "section", title: "Page 2", required: false },
          { id: "q-page-2", type: "short", title: "Question on page 2", required: false },
          { id: "page-3", type: "section", title: "Page 3", required: false },
          { id: "q-page-3", type: "short", title: "Question on page 3", required: false },
        ])}
      />
    )

    fireEvent.click(screen.getByText("A"))
    fireEvent.click(screen.getByText("B"))
    fireEvent.click(screen.getByRole("button", { name: /next/i }))

    expect(screen.getByText("Question on page 3")).toBeInTheDocument()
    expect(screen.queryByText("Question on page 2")).not.toBeInTheDocument()
  })
})
