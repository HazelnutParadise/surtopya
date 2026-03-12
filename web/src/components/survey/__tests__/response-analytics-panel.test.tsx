import { fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"
import { ResponseAnalyticsPanel } from "@/components/survey/response-analytics-panel"

const messages = {
  SurveyManagement: {
    responseAnalyticsTitle: "Question analytics",
    responseAnalyticsDescription: "Per-question summary of completed responses",
    responseAnalyticsLoading: "Loading analytics...",
    responseAnalyticsError: "Analytics unavailable",
    responseAnalyticsWarningsTitle: "Analytics warnings",
    responseAnalyticsNoResponses: "No completed responses yet",
    responseAnalyticsResponsesCount: "{count} answers",
    responseAnalyticsAverageLabel: "Average",
    responseAnalyticsVersionLabel: "Version scope",
    responseAnalyticsVersionAll: "All versions",
    responseAnalyticsVersionSingle: "Version {version}",
    responseAnalyticsMoreResponses: "+{count} more",
  },
}

describe("ResponseAnalyticsPanel", () => {
  it("does not crash when top-level analytics arrays are missing", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ResponseAnalyticsPanel
          analytics={
            {
              selectedVersion: "all",
              summary: {
                totalCompletedResponses: 0,
                questionCount: 0,
                generatedAt: "2026-03-12T12:00:00Z",
              },
            } as unknown as Parameters<typeof ResponseAnalyticsPanel>[0]["analytics"]
          }
          loading={false}
          error={null}
          selectedVersion="all"
          onVersionChange={vi.fn()}
        />
      </NextIntlClientProvider>
    )

    expect(screen.getByText("Question analytics")).toBeInTheDocument()
    expect(screen.getByText("No completed responses yet")).toBeInTheDocument()
    expect(screen.getByTestId("response-analytics-version-select")).toHaveValue("all")
  })

  it("does not crash when nested analytics arrays are null", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ResponseAnalyticsPanel
          analytics={
            {
              selectedVersion: "all",
              availableVersions: null,
              summary: {
                totalCompletedResponses: 1,
                questionCount: 1,
                generatedAt: "2026-03-12T12:00:00Z",
              },
              questions: [
                {
                  questionId: "q-text",
                  title: "Comment",
                  questionType: "text",
                  responseCount: 1,
                  textResponses: null,
                  optionCounts: null,
                },
              ],
              warnings: null,
            } as unknown as Parameters<typeof ResponseAnalyticsPanel>[0]["analytics"]
          }
          loading={false}
          error={null}
          selectedVersion="all"
          onVersionChange={vi.fn()}
        />
      </NextIntlClientProvider>
    )

    expect(screen.getByText("Comment")).toBeInTheDocument()
    expect(screen.queryByText("Analytics warnings")).not.toBeInTheDocument()
  })

  it("renders warnings, analytics cards, and version options", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ResponseAnalyticsPanel
          analytics={{
            selectedVersion: "all",
            availableVersions: [3, 2, 1],
            summary: {
              totalCompletedResponses: 3,
              questionCount: 2,
              generatedAt: "2026-03-12T12:00:00Z",
            },
            questions: [
              {
                questionId: "q-single",
                title: "Favorite option",
                questionType: "single",
                responseCount: 3,
                optionCounts: [
                  { label: "Blue", count: 2, percentage: 66.6667 },
                  { label: "Green", count: 1, percentage: 33.3333 },
                ],
              },
              {
                questionId: "q-text",
                title: "Comment",
                questionType: "text",
                responseCount: 3,
                textResponses: ["Newest comment", "Older comment"],
                hasMoreResponses: true,
              },
            ],
            warnings: ["Question q-legacy changed type across selected versions and was skipped."],
          }}
          loading={false}
          error={null}
          selectedVersion="all"
          onVersionChange={vi.fn()}
        />
      </NextIntlClientProvider>
    )

    expect(screen.getByText("Question analytics")).toBeInTheDocument()
    expect(screen.getByText("Analytics warnings")).toBeInTheDocument()
    expect(screen.getByText("Favorite option")).toBeInTheDocument()
    expect(screen.getByText("Blue")).toBeInTheDocument()
    expect(screen.getByText("2 · 67%")).toBeInTheDocument()
    expect(screen.getByText("Comment")).toBeInTheDocument()
    expect(screen.getByText("Newest comment")).toBeInTheDocument()
    expect(screen.getByText("+1 more")).toBeInTheDocument()
    expect(screen.getByTestId("response-analytics-version-select")).toHaveValue("all")
  })

  it("supports version switching and loading state", () => {
    const onVersionChange = vi.fn()

    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ResponseAnalyticsPanel
          analytics={null}
          loading
          error={null}
          selectedVersion="all"
          onVersionChange={onVersionChange}
        />
      </NextIntlClientProvider>
    )

    expect(screen.getByText("Loading analytics...")).toBeInTheDocument()

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ResponseAnalyticsPanel
          analytics={{
            selectedVersion: "2",
            availableVersions: [2, 1],
            summary: {
              totalCompletedResponses: 1,
              questionCount: 1,
              generatedAt: "2026-03-12T12:00:00Z",
            },
            questions: [],
            warnings: [],
          }}
          loading={false}
          error={null}
          selectedVersion="2"
          onVersionChange={onVersionChange}
        />
      </NextIntlClientProvider>
    )

    fireEvent.change(screen.getByTestId("response-analytics-version-select"), {
      target: { value: "1" },
    })

    expect(onVersionChange).toHaveBeenCalledWith("1")
  })
})
