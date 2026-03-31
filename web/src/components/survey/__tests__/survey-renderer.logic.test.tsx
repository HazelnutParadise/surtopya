import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SurveyRenderer } from "@/components/survey/survey-renderer"
import type { Survey } from "@/types/survey"

const messages: Record<string, Record<string, string>> = {
  SurveyRenderer: {
    requiredAlert: "Please complete required questions.",
    otherTextRequiredAlert: 'Please add details for "{question}".',
    otherTextRequiredHint: "Please fill in the details before continuing.",
    minSelectionsAlert: 'Select at least {count} options for "{question}".',
    maxSelectionsAlert: 'Select no more than {count} options for "{question}".',
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

  it("falls back to the section default destination when no logic rule matches", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          {
            id: "page-1",
            type: "section",
            title: "Page 1",
            required: false,
            defaultDestinationQuestionId: "page-3",
          },
          {
            id: "q1",
            type: "single",
            title: "First question",
            required: true,
            options: [{ id: "opt-a", label: "A" }],
          },
          { id: "page-2", type: "section", title: "Page 2", required: false },
          { id: "q-page-2", type: "short", title: "Question on page 2", required: false },
          { id: "page-3", type: "section", title: "Page 3", required: false },
          { id: "q-page-3", type: "short", title: "Question on page 3", required: false },
        ])}
      />
    )

    fireEvent.click(screen.getByText("A"))
    fireEvent.click(screen.getByRole("button", { name: /next/i }))

    expect(screen.getByText("Question on page 3")).toBeInTheDocument()
    expect(screen.queryByText("Question on page 2")).not.toBeInTheDocument()
  })

  it("updates the primary action immediately when answers change the resolved destination", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          {
            id: "page-1",
            type: "section",
            title: "Page 1",
            required: false,
            defaultDestinationQuestionId: "page-2",
          },
          {
            id: "q1",
            type: "single",
            title: "First question",
            required: true,
            options: [
              { id: "opt-a", label: "A" },
              { id: "opt-b", label: "B" },
            ],
            logic: [
              {
                operator: "or",
                conditions: [{ optionId: "opt-a", match: "includes" }],
                destinationQuestionId: "end_survey",
              },
            ],
          },
          { id: "page-2", type: "section", title: "Page 2", required: false },
          { id: "q-page-2", type: "short", title: "Question on page 2", required: false },
        ])}
      />
    )

    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument()

    fireEvent.click(screen.getByText("A"))
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^next$/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("B"))
    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument()
  })

  it("uses branch history for back navigation", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          {
            id: "page-1",
            type: "section",
            title: "Page 1",
            required: false,
            defaultDestinationQuestionId: "page-3",
          },
          {
            id: "q1",
            type: "single",
            title: "First question",
            required: true,
            options: [{ id: "opt-a", label: "A" }],
          },
          { id: "page-2", type: "section", title: "Page 2", required: false },
          { id: "q-page-2", type: "short", title: "Question on page 2", required: false },
          { id: "page-3", type: "section", title: "Page 3", required: false },
          { id: "q-page-3", type: "short", title: "Question on page 3", required: false },
        ])}
      />
    )

    fireEvent.click(screen.getByText("A"))
    fireEvent.click(screen.getByRole("button", { name: /next/i }))
    fireEvent.click(screen.getByRole("button", { name: /back/i }))

    expect(screen.getByText("First question")).toBeInTheDocument()
    expect(screen.queryByText("Question on page 2")).not.toBeInTheDocument()
  })

  it("rebuilds the branch when an earlier answer changes after navigating back", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          { id: "page-1", type: "section", title: "Page 1", required: false },
          {
            id: "q1",
            type: "single",
            title: "First question",
            required: true,
            options: [
              { id: "opt-a", label: "A" },
              { id: "opt-b", label: "B" },
            ],
            logic: [
              {
                operator: "or",
                conditions: [{ optionId: "opt-a", match: "includes" }],
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
          { id: "q-page-2", type: "short", title: "Question on page 2", required: false },
          { id: "page-3", type: "section", title: "Page 3", required: false },
          { id: "q-page-3", type: "short", title: "Question on page 3", required: false },
        ])}
      />
    )

    fireEvent.click(screen.getByText("A"))
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }))
    expect(screen.getByText("Question on page 2")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /back/i }))
    fireEvent.click(screen.getByText("B"))
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }))

    expect(screen.getByText("Question on page 3")).toBeInTheDocument()
    expect(screen.queryByText("Question on page 2")).not.toBeInTheDocument()
  })

  it("enforces exclusive options and selection bounds for multi questions", () => {
    const onComplete = vi.fn()

    render(
      <SurveyRenderer
        survey={createSurvey([
          { id: "page-1", type: "section", title: "Page 1", required: false },
          {
            id: "q1",
            type: "multi",
            title: "Choose options",
            required: true,
            minSelections: 2,
            maxSelections: 2,
            options: [
              { id: "opt-exclusive", label: "None of the above", exclusive: true },
              { id: "opt-a", label: "A" },
              { id: "opt-b", label: "B" },
              { id: "opt-c", label: "C" },
            ],
          },
        ])}
        onComplete={onComplete}
      />
    )

    fireEvent.click(screen.getByText("None of the above"))
    fireEvent.click(screen.getByText("A"))
    fireEvent.click(screen.getByRole("button", { name: /submit/i }))

    expect(screen.getAllByText('Select at least 2 options for "Choose options".')).toHaveLength(2)

    fireEvent.click(screen.getByText("B"))
    fireEvent.click(screen.getByRole("button", { name: /submit/i }))

    expect(onComplete).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText("C"))
    fireEvent.click(screen.getByRole("button", { name: /submit/i }))

    expect(screen.getAllByText('Select no more than 2 options for "Choose options".')).toHaveLength(2)
  })

  it("keeps the current page and marks each invalid question when next validation fails", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          { id: "page-1", type: "section", title: "Page 1", required: false },
          { id: "q1", type: "short", title: "Question 1", required: true },
          { id: "q2", type: "rating", title: "Question 2", required: true, maxRating: 5 },
          { id: "page-2", type: "section", title: "Page 2", required: false },
          { id: "q-page-2", type: "short", title: "Question on page 2", required: false },
        ])}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /^next$/i }))

    expect(screen.getByText("Question 1")).toBeInTheDocument()
    expect(screen.queryByText("Question on page 2")).not.toBeInTheDocument()
    expect(screen.getByTestId("survey-question-q1")).toHaveAttribute("data-invalid", "true")
    expect(screen.getByTestId("survey-question-q2")).toHaveAttribute("data-invalid", "true")
    expect(screen.getByTestId("survey-question-error-q1")).toHaveTextContent(
      "Please complete required questions."
    )
    expect(screen.getByTestId("survey-question-error-q2")).toHaveTextContent(
      "Please complete required questions."
    )
  })

  it("shows submit when the resolved next step ends the flow before the last physical page", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          {
            id: "page-1",
            type: "section",
            title: "Page 1",
            required: false,
            defaultDestinationQuestionId: "page-3",
          },
          {
            id: "q1",
            type: "single",
            title: "First question",
            required: true,
            options: [{ id: "opt-a", label: "A" }],
          },
          { id: "page-2", type: "section", title: "Page 2", required: false },
          { id: "q-page-2", type: "short", title: "Question on page 2", required: false },
          { id: "page-3", type: "section", title: "Page 3", required: false },
        ])}
      />
    )

    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^next$/i })).not.toBeInTheDocument()
  })

  it("uses submit when the section default destination is end_survey", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          {
            id: "page-1",
            type: "section",
            title: "Page 1",
            required: false,
            defaultDestinationQuestionId: "end_survey",
          },
          {
            id: "q1",
            type: "single",
            title: "First question",
            required: true,
            options: [{ id: "opt-a", label: "A" }],
          },
          { id: "page-2", type: "section", title: "Page 2", required: false },
          { id: "q-page-2", type: "short", title: "Question on page 2", required: false },
        ])}
      />
    )

    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^next$/i })).not.toBeInTheDocument()
  })
})
