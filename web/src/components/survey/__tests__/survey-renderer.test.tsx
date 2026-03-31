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
    id: "survey-1",
    title: "Welcome **friend**",
    description: "Choose your **favorite** answer.",
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

describe("SurveyRenderer", () => {
  it("renders markdown content for survey and question descriptions", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          {
            id: "q1",
            type: "short",
            title: "Question title",
            description: "Write _something_ here.",
            required: false,
          },
        ])}
      />
    )

    expect(screen.getByText("Welcome **friend**")).toBeInTheDocument()
    expect(screen.getByText("favorite", { selector: "strong" })).toBeInTheDocument()
    expect(screen.getByText("something", { selector: "em" })).toBeInTheDocument()
  })

  it("allows submitting when supplemental text is optional", () => {
    const onComplete = vi.fn()

    render(
      <SurveyRenderer
        survey={createSurvey([
          {
            id: "q1",
            type: "single",
            title: "Favorite option",
            required: true,
            options: [
              { label: "Regular" },
              { label: "Can add details", isOther: true },
            ] as unknown as string[],
          },
        ])}
        isPreview
        onComplete={onComplete}
      />
    )

    expect(screen.getByText("Single choice")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Can add details"))

    expect(screen.getByPlaceholderText("Please specify")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /submit/i }))

    expect(screen.queryByText("Please complete required questions.")).not.toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("does not show required errors before interaction, but validates touched short answers inline", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          {
            id: "q1",
            type: "short",
            title: "Your name",
            required: true,
          },
        ])}
      />
    )

    const input = screen.getByPlaceholderText("Type here")

    expect(screen.queryByTestId("survey-question-error-q1")).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute("aria-invalid", "true")

    fireEvent.change(input, { target: { value: "Alice" } })
    fireEvent.change(input, { target: { value: "   " } })

    expect(screen.getByTestId("survey-question-error-q1")).toHaveTextContent(
      "Please complete required questions."
    )
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByTestId("survey-question-q1")).toHaveAttribute("data-invalid", "true")
  })

  it("shows submit-time inline errors for untouched required questions", () => {
    const onComplete = vi.fn()

    render(
      <SurveyRenderer
        survey={createSurvey([
          {
            id: "q1",
            type: "short",
            title: "Your name",
            required: true,
          },
        ])}
        onComplete={onComplete}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /submit/i }))

    expect(screen.getAllByText("Please complete required questions.")).toHaveLength(2)
    expect(screen.getByTestId("survey-question-error-q1")).toHaveTextContent(
      "Please complete required questions."
    )
    expect(screen.getByPlaceholderText("Type here")).toHaveAttribute("aria-invalid", "true")
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("blocks preview submission when required supplemental text is missing", () => {
    const onComplete = vi.fn()

    render(
      <SurveyRenderer
        survey={createSurvey([
          {
            id: "q1",
            type: "single",
            title: "Favorite option",
            required: true,
            options: [
              { label: "Regular" },
              { label: "Can add details", isOther: true, requireOtherText: true },
            ] as unknown as string[],
          },
        ])}
        isPreview
        onComplete={onComplete}
      />
    )

    fireEvent.click(screen.getByText("Can add details"))
    fireEvent.click(screen.getByRole("button", { name: /submit/i }))

    expect(screen.getByText('Please add details for "Favorite option".')).toBeInTheDocument()
    expect(screen.getByText("Please fill in the details before continuing.")).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("validates required supplemental text inline as soon as the question becomes invalid", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          {
            id: "q1",
            type: "single",
            title: "Favorite option",
            required: true,
            options: [
              { label: "Regular" },
              { label: "Can add details", isOther: true, requireOtherText: true },
            ] as unknown as string[],
          },
        ])}
      />
    )

    fireEvent.click(screen.getByText("Can add details"))

    const otherInput = screen.getByPlaceholderText("Please specify")
    expect(otherInput).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByText("Please fill in the details before continuing.")).toBeInTheDocument()

    fireEvent.change(otherInput, { target: { value: "Extra detail" } })

    expect(screen.queryByText("Please fill in the details before continuing.")).not.toBeInTheDocument()
    expect(otherInput).not.toHaveAttribute("aria-invalid", "true")
  })

  it("treats whitespace-only required text answers as invalid", () => {
    const onComplete = vi.fn()

    render(
      <SurveyRenderer
        survey={createSurvey([
          {
            id: "q1",
            type: "short",
            title: "Your name",
            required: true,
          },
        ])}
        onComplete={onComplete}
      />
    )

    fireEvent.change(screen.getByPlaceholderText("Type here"), {
      target: { value: "   " },
    })

    fireEvent.click(screen.getByRole("button", { name: /submit/i }))

    expect(screen.getAllByText("Please complete required questions.")).toHaveLength(2)
    expect(screen.getByTestId("survey-question-error-q1")).toHaveTextContent(
      "Please complete required questions."
    )
    expect(screen.getByPlaceholderText("Type here")).toHaveAttribute("aria-invalid", "true")
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("shows multi-select min and max issues inline on the question", () => {
    render(
      <SurveyRenderer
        survey={createSurvey([
          {
            id: "q1",
            type: "multi",
            title: "Choose options",
            required: true,
            minSelections: 2,
            maxSelections: 2,
            options: ["A", "B", "C"],
          },
        ])}
      />
    )

    fireEvent.click(screen.getByText("A"))
    expect(screen.getByTestId("survey-question-error-q1")).toHaveTextContent(
      'Select at least 2 options for "Choose options".'
    )
    expect(screen.getByTestId("survey-question-q1")).toHaveAttribute("data-invalid", "true")

    fireEvent.click(screen.getByText("B"))
    expect(screen.queryByTestId("survey-question-error-q1")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("C"))
    expect(screen.getByTestId("survey-question-error-q1")).toHaveTextContent(
      'Select no more than 2 options for "Choose options".'
    )
  })
})
