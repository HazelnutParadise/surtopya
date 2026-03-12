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
    responseAnalyticsPageLabel: "Page {page}",
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
              pages: [
                {
                  pageId: "page-1",
                  title: "",
                  questionCount: 1,
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

  it("renders warnings, page tabs, analytics cards, and version options", () => {
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
            pages: [
              {
                pageId: "page-1",
                title: "",
                questionCount: 1,
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
                    textResponses: [],
                  },
                ],
              },
              {
                pageId: "page-2",
                title: "Follow-up",
                questionCount: 1,
                questions: [
                  {
                    questionId: "q-text",
                    title: "Comment",
                    questionType: "text",
                    responseCount: 3,
                    optionCounts: [],
                    textResponses: ["Newest comment", "Older comment"],
                    hasMoreResponses: true,
                  },
                ],
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
    expect(screen.getByRole("tab", { name: "Page 1" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Follow-up" })).toBeInTheDocument()
    expect(screen.getByText("Favorite option")).toBeInTheDocument()
    expect(screen.getByText("Blue")).toBeInTheDocument()
    expect(screen.getByText("2 / 67%")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Follow-up" }))

    expect(screen.getByText("Comment")).toBeInTheDocument()
    expect(screen.getByText("Newest comment")).toBeInTheDocument()
    expect(screen.getByText("+1 more")).toBeInTheDocument()
    expect(screen.getByTestId("response-analytics-version-select")).toHaveValue("all")
  })

  it("supports version switching, keeps tabs horizontally scrollable, and resets to the first page on version changes", () => {
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
              questionCount: 2,
              generatedAt: "2026-03-12T12:00:00Z",
            },
            pages: [
              {
                pageId: "page-1",
                title: "",
                questionCount: 1,
                questions: [
                  {
                    questionId: "q-one",
                    title: "Version 2 question",
                    questionType: "short",
                    responseCount: 1,
                    optionCounts: [],
                    textResponses: [],
                  },
                ],
              },
              {
                pageId: "page-2",
                title: "Extra page",
                questionCount: 1,
                questions: [
                  {
                    questionId: "q-two",
                    title: "Second page question",
                    questionType: "text",
                    responseCount: 1,
                    optionCounts: [],
                    textResponses: ["visible"],
                  },
                ],
              },
            ],
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
    expect(screen.getByTestId("response-analytics-page-tabs")).toHaveClass("overflow-x-auto")

    fireEvent.click(screen.getByRole("tab", { name: "Extra page" }))
    expect(screen.getByText("Second page question")).toBeInTheDocument()

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ResponseAnalyticsPanel
          analytics={{
            selectedVersion: "1",
            availableVersions: [2, 1],
            summary: {
              totalCompletedResponses: 1,
              questionCount: 1,
              generatedAt: "2026-03-12T12:00:00Z",
            },
            pages: [
              {
                pageId: "page-1",
                title: "",
                questionCount: 1,
                questions: [
                  {
                    questionId: "q-three",
                    title: "Version 1 question",
                    questionType: "text",
                    responseCount: 1,
                    optionCounts: [],
                    textResponses: ["older"],
                  },
                ],
              },
            ],
            warnings: [],
          }}
          loading={false}
          error={null}
          selectedVersion="1"
          onVersionChange={onVersionChange}
        />
      </NextIntlClientProvider>
    )

    expect(screen.getByRole("tab", { name: "Page 1" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Version 1 question")).toBeInTheDocument()
  })

  it("uses a page-level scroll container for the active page even when there is only one page", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ResponseAnalyticsPanel
          analytics={{
            selectedVersion: "all",
            availableVersions: [1],
            summary: {
              totalCompletedResponses: 4,
              questionCount: 4,
              generatedAt: "2026-03-12T12:00:00Z",
            },
            pages: [
              {
                pageId: "page-1",
                title: "",
                questionCount: 4,
                questions: [
                  {
                    questionId: "q-1",
                    title: "Question 1",
                    questionType: "single",
                    responseCount: 4,
                    optionCounts: [{ label: "Yes", count: 4, percentage: 100 }],
                    textResponses: [],
                  },
                  {
                    questionId: "q-2",
                    title: "Question 2",
                    questionType: "single",
                    responseCount: 4,
                    optionCounts: [{ label: "Yes", count: 4, percentage: 100 }],
                    textResponses: [],
                  },
                  {
                    questionId: "q-3",
                    title: "Question 3",
                    questionType: "single",
                    responseCount: 4,
                    optionCounts: [{ label: "Yes", count: 4, percentage: 100 }],
                    textResponses: [],
                  },
                  {
                    questionId: "q-4",
                    title: "Question 4",
                    questionType: "single",
                    responseCount: 4,
                    optionCounts: [{ label: "Yes", count: 4, percentage: 100 }],
                    textResponses: [],
                  },
                ],
              },
            ],
            warnings: [],
          }}
          loading={false}
          error={null}
          selectedVersion="all"
          onVersionChange={vi.fn()}
        />
      </NextIntlClientProvider>
    )

    const pageScroll = screen.getByTestId("response-analytics-page-scroll")

    expect(pageScroll).toHaveClass("h-[70vh]")
    expect(pageScroll).toHaveClass("overflow-y-auto")
    expect(screen.getByText("Question 4")).toBeInTheDocument()
  })

  it("resets the active-page scroll position when switching page tabs and analytics versions", () => {
    const onVersionChange = vi.fn()

    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ResponseAnalyticsPanel
          analytics={{
            selectedVersion: "2",
            availableVersions: [2, 1],
            summary: {
              totalCompletedResponses: 2,
              questionCount: 2,
              generatedAt: "2026-03-12T12:00:00Z",
            },
            pages: [
              {
                pageId: "page-1",
                title: "",
                questionCount: 1,
                questions: [
                  {
                    questionId: "q-one",
                    title: "Version 2 question",
                    questionType: "text",
                    responseCount: 1,
                    optionCounts: [],
                    textResponses: ["first"],
                  },
                ],
              },
              {
                pageId: "page-2",
                title: "Extra page",
                questionCount: 1,
                questions: [
                  {
                    questionId: "q-two",
                    title: "Second page question",
                    questionType: "text",
                    responseCount: 1,
                    optionCounts: [],
                    textResponses: ["second"],
                  },
                ],
              },
            ],
            warnings: [],
          }}
          loading={false}
          error={null}
          selectedVersion="2"
          onVersionChange={onVersionChange}
        />
      </NextIntlClientProvider>
    )

    const firstScroll = screen.getByTestId("response-analytics-page-scroll")
    firstScroll.scrollTop = 120

    fireEvent.click(screen.getByRole("tab", { name: "Extra page" }))

    const secondScroll = screen.getByTestId("response-analytics-page-scroll")
    expect(secondScroll.scrollTop).toBe(0)

    secondScroll.scrollTop = 80

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ResponseAnalyticsPanel
          analytics={{
            selectedVersion: "1",
            availableVersions: [2, 1],
            summary: {
              totalCompletedResponses: 1,
              questionCount: 1,
              generatedAt: "2026-03-12T12:00:00Z",
            },
            pages: [
              {
                pageId: "page-1",
                title: "",
                questionCount: 1,
                questions: [
                  {
                    questionId: "q-three",
                    title: "Version 1 question",
                    questionType: "text",
                    responseCount: 1,
                    optionCounts: [],
                    textResponses: ["older"],
                  },
                ],
              },
            ],
            warnings: [],
          }}
          loading={false}
          error={null}
          selectedVersion="1"
          onVersionChange={onVersionChange}
        />
      </NextIntlClientProvider>
    )

    const resetScroll = screen.getByTestId("response-analytics-page-scroll")

    expect(resetScroll.scrollTop).toBe(0)
    expect(screen.getByRole("tab", { name: "Page 1" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Version 1 question")).toBeInTheDocument()
  })

  it("uses a fixed-height scroll container for question cards", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ResponseAnalyticsPanel
          analytics={{
            selectedVersion: "all",
            availableVersions: [1],
            summary: {
              totalCompletedResponses: 1,
              questionCount: 1,
              generatedAt: "2026-03-12T12:00:00Z",
            },
            pages: [
              {
                pageId: "page-1",
                title: "",
                questionCount: 1,
                questions: [
                  {
                    questionId: "q-text",
                    title: "Comment",
                    questionType: "text",
                    responseCount: 1,
                    optionCounts: [],
                    textResponses: ["line 1", "line 2"],
                  },
                ],
              },
            ],
            warnings: [],
          }}
          loading={false}
          error={null}
          selectedVersion="all"
          onVersionChange={vi.fn()}
        />
      </NextIntlClientProvider>
    )

    expect(screen.getByTestId("response-analytics-card-scroll-q-text")).toHaveClass("overflow-y-auto")
  })
})
