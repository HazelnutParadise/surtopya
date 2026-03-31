import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PreviewResponseReview } from "@/components/survey/preview-response-review"
import type { Survey } from "@/types/survey"

const messages: Record<string, Record<string, string>> = {
  PreviewResponseReview: {
    title: "Preview answers",
    empty: "No answers yet.",
    otherTextLabel: "Details",
    ratingValue: "{value} / {max}",
  },
}

const formatMessage = (template: string, values?: Record<string, string | number>) => {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))
}

vi.mock("next-intl", () => ({
  useLocale: () => "en-US",
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string | number>) =>
    formatMessage(messages[namespace]?.[key] ?? key, values),
}))

const survey: Survey = {
  id: "survey-1",
  title: "Preview survey",
  description: "Description",
  settings: {
    isPublic: true,
    isResponseOpen: true,
    requireLoginToRespond: false,
    visibility: "public",
    isDatasetActive: true,
    pointsReward: 0,
  },
  questions: [
    {
      id: "q-single",
      type: "single",
      title: "Favorite choice",
      required: false,
      options: [
        { label: "Regular" },
        { label: "Other", isOther: true, requireOtherText: true },
      ],
    },
    {
      id: "q-multi",
      type: "multi",
      title: "Select tags",
      required: false,
      options: [
        { label: "Alpha" },
        { label: "Beta" },
        { label: "Other", isOther: true },
      ],
    },
    {
      id: "q-rating",
      type: "rating",
      title: "Rating",
      required: false,
      maxRating: 7,
    },
    {
      id: "q-date",
      type: "date",
      title: "When",
      required: false,
    },
    {
      id: "q-short",
      type: "short",
      title: "Name",
      required: false,
    },
  ],
}

describe("PreviewResponseReview", () => {
  it("formats answered values across supported question types", () => {
    const formattedDate = new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, 2, 31)))

    render(
      <PreviewResponseReview
        survey={survey}
        answers={{
          "q-single": { value: "Other", otherText: "Custom answer" },
          "q-multi": { values: ["Alpha", "Other"], otherText: "Side note" },
          "q-rating": 5,
          "q-date": "2026-03-31",
          "q-short": "Alice",
        }}
        displayMode="full-screen"
      />
    )

    expect(screen.getByText("Favorite choice")).toBeInTheDocument()
    expect(screen.getAllByText("Other")).toHaveLength(2)
    expect(screen.getByText("Custom answer")).toBeInTheDocument()
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Side note")).toBeInTheDocument()
    expect(screen.getByText("5 / 7")).toBeInTheDocument()
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText(formattedDate)).toBeInTheDocument()
  })

  it("skips unanswered questions", () => {
    render(
      <PreviewResponseReview
        survey={survey}
        answers={{
          "q-short": "Alice",
        }}
        displayMode="modal"
      />
    )

    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.queryByText("Favorite choice")).not.toBeInTheDocument()
    expect(screen.queryByText("Select tags")).not.toBeInTheDocument()
  })
})
