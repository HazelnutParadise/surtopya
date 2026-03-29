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
            options: [
              { id: "opt-a", label: "A" },
              { id: "opt-b", label: "B" },
              { id: "opt-c", label: "C" },
            ],
            logic: [
              {
                operator: "and",
                conditions: [
                  { optionId: "opt-a", match: "includes" },
                  { optionId: "opt-c", match: "excludes" },
                ],
                destinationQuestionId: "page-2",
              },
              {
                operator: "or",
                conditions: [{ optionId: "opt-b", match: "includes" }],
                destinationQuestionId: "page-3",
              },
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
            options: [{ id: "opt-a", label: "A" }],
            logic: [
              {
                operator: "or",
                conditions: [{ optionId: "opt-a", match: "includes" }],
                destinationQuestionId: "page-2",
              },
            ],
          },
          {
            id: "q2",
            type: "single",
            title: "Second question",
            required: true,
            options: [{ id: "opt-b", label: "B" }],
            logic: [
              {
                operator: "or",
                conditions: [{ optionId: "opt-b", match: "includes" }],
                destinationQuestionId: "page-3",
              },
            ],
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

  it("supports rating logic jumps with inclusive between rules", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          { id: "page-1", type: "section", title: "Page 1", required: false },
          {
            id: "q1",
            type: "rating",
            title: "Rate this",
            required: true,
            maxRating: 5,
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
          },
          { id: "page-2", type: "section", title: "Page 2", required: false },
          { id: "q-page-2", type: "short", title: "Question on page 2", required: false },
        ])}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "5 stars" }))
    fireEvent.click(screen.getByRole("button", { name: /next/i }))

    expect(screen.getByText("Question on page 2")).toBeInTheDocument()
  })

  it("supports date logic jumps with inclusive between rules", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          { id: "page-1", type: "section", title: "Page 1", required: false },
          {
            id: "q1",
            type: "date",
            title: "Pick a date",
            required: true,
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
          },
          { id: "page-2", type: "section", title: "Page 2", required: false },
          { id: "q-page-2", type: "short", title: "Question on page 2", required: false },
        ])}
      />
    )

    fireEvent.change(screen.getByLabelText("Pick a date"), { target: { value: "2026-04-10" } })
    fireEvent.click(screen.getByRole("button", { name: /next/i }))

    expect(screen.getByText("Question on page 2")).toBeInTheDocument()
  })
})
