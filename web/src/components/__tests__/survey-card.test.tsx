import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ComponentProps } from "react"
import { describe, expect, it } from "vitest"
import { SurveyCard } from "@/components/survey-card"

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
    alreadySubmitted: "Already Submitted",
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

describe("SurveyCard ribbons", () => {
  it("shows only HOT ribbon when hot and not submitted", () => {
    renderSurveyCard({ isHot: true, hasResponded: false })

    expect(screen.getByText("HOT")).toBeInTheDocument()
    expect(screen.queryByText("Already Submitted")).not.toBeInTheDocument()
  })

  it("shows only already-submitted ribbon when submitted and not hot", () => {
    renderSurveyCard({ isHot: false, hasResponded: true })

    expect(screen.queryByText("HOT")).not.toBeInTheDocument()
    expect(screen.getByText("Already Submitted")).toBeInTheDocument()
  })

  it("shows both ribbons when hot and already submitted", () => {
    renderSurveyCard({ isHot: true, hasResponded: true })

    expect(screen.getByText("HOT")).toBeInTheDocument()
    expect(screen.getByText("Already Submitted")).toBeInTheDocument()
  })

  it("does not show explore ribbons in dashboard variant", () => {
    renderSurveyCard({
      variant: "dashboard",
      isHot: true,
      hasResponded: true,
      currentPublishedVersionNumber: 1,
      isResponseOpen: true,
    })

    expect(screen.queryByText("HOT")).not.toBeInTheDocument()
    expect(screen.queryByText("Already Submitted")).not.toBeInTheDocument()
  })
})
