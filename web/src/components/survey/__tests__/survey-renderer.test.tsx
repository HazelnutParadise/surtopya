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

    expect(screen.getByText("Please complete required questions.")).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })
})
