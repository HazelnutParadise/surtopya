import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import { SurveyResponseSummaryCards } from "@/components/survey/survey-response-summary-cards"

const messages = {
  SurveyManagement: {
    totalResponses: "Total Responses",
    lastResponse: "Last Response",
    questions: "Questions",
  },
}

describe("SurveyResponseSummaryCards", () => {
  it("uses a safer responsive grid and shows only the three non-duplicated summary cards", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SurveyResponseSummaryCards
          totalResponses={12}
          questionCount={31}
          lastResponseDate="2026/03/12"
          lastResponseTime="04:26 PM"
        />
      </NextIntlClientProvider>
    )

    const grid = screen.getByTestId("survey-response-summary-grid")

    expect(grid).toHaveClass("md:grid-cols-2")
    expect(grid).toHaveClass("xl:grid-cols-3")
    expect(grid).not.toHaveClass("2xl:grid-cols-4")
    expect(grid.children).toHaveLength(3)
    expect(screen.queryByText("Completed Responses")).not.toBeInTheDocument()
    expect(screen.queryByTestId("summary-completed-responses")).not.toBeInTheDocument()
  })

  it("renders the last response as separate date and time lines to avoid overflow", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SurveyResponseSummaryCards
          totalResponses={1}
          questionCount={4}
          lastResponseDate="2026/03/12"
          lastResponseTime="04:26 PM"
        />
      </NextIntlClientProvider>
    )

    expect(screen.getByTestId("summary-last-response-date")).toHaveTextContent("2026/03/12")
    expect(screen.getByTestId("summary-last-response-date")).toHaveClass("break-words")
    expect(screen.getByTestId("summary-last-response-time")).toHaveTextContent("04:26 PM")
  })

  it("shows a placeholder when there is no last response yet", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SurveyResponseSummaryCards
          totalResponses={0}
          questionCount={0}
        />
      </NextIntlClientProvider>
    )

    expect(screen.getByTestId("summary-last-response-date")).toHaveTextContent("--")
    expect(screen.queryByTestId("summary-last-response-time")).not.toBeInTheDocument()
  })
})
