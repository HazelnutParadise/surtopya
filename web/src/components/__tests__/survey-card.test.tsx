import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import { SurveyCard } from "@/components/survey-card"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

const messages = {
  SurveyCard: {
    hot: "HOT",
    newChanges: "NEW CHANGES",
    minutes: "{count} min",
    responses: "{count}",
    public: "Public",
    nonPublic: "Non-public",
    points: "{count} PTS",
    loginRequired: "Login Required",
    alreadySubmitted: "Completed",
    anonymousAuthor: "Anonymous author",
  },
  Dashboard: {
    statusPublished: "Published",
    statusDraft: "Draft",
    statusEditedUnpublished: "Edited",
    statusResponsesOpen: "Responses Open",
    statusResponsesClosed: "Responses Closed",
  },
}

const renderSurveyCard = (props: Partial<ComponentProps<typeof SurveyCard>> = {}) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SurveyCard
        id="survey-1"
        title="Customer Survey"
        description="Please share your feedback."
        points={10}
        responses={12}
        {...props}
      />
    </NextIntlClientProvider>
  )

describe("SurveyCard status labels", () => {
  it("shows only HOT status when hot and not submitted", () => {
    renderSurveyCard({ isHot: true, hasResponded: false })

    expect(screen.getByText("HOT")).toBeInTheDocument()
    expect(screen.queryByText("Completed")).not.toBeInTheDocument()
  })

  it("shows only already-submitted status when submitted and not hot", () => {
    renderSurveyCard({ isHot: false, hasResponded: true })

    expect(screen.queryByText("HOT")).not.toBeInTheDocument()
    expect(screen.getByText("Completed")).toBeInTheDocument()
    const card = screen.getByTestId("survey-card-survey-1")
    expect(card).toHaveClass("bg-slate-100")
    expect(card).not.toHaveClass("grayscale-[0.4]")
    expect(card).not.toHaveClass("opacity-75")
    expect(screen.getByTestId("survey-card-status-completed-survey-1")).toHaveClass("text-emerald-700", "bg-emerald-100")
  })

  it("shows both statuses when hot and already submitted", () => {
    renderSurveyCard({ isHot: true, hasResponded: true })

    expect(screen.getByText("HOT")).toBeInTheDocument()
    expect(screen.getByText("Completed")).toBeInTheDocument()
    expect(screen.getByTestId("survey-card-statuses-survey-1")).toHaveClass("mr-auto", "items-start")
  })

  it("does not show explore statuses in dashboard variant", () => {
    renderSurveyCard({
      variant: "dashboard",
      isHot: true,
      hasResponded: true,
      currentPublishedVersionNumber: 1,
      isResponseOpen: true,
    })

    expect(screen.queryByText("HOT")).not.toBeInTheDocument()
    expect(screen.queryByText("Completed")).not.toBeInTheDocument()
  })
})
