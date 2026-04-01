import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ThankYouPage from "@/app/survey/thank-you/page"
import { writeResponseCompletionCopy } from "@/lib/response-completion"

const mocks = vi.hoisted(() => ({
  pathname: "/en/survey/thank-you",
  searchParams: new URLSearchParams("points=6&responseId=response-1"),
}))

const messages: Record<string, Record<string, string>> = {
  ThankYou: {
    title: "Default title",
    subtitle: "Default subtitle",
    pointsEarned: "Points earned",
    message: "Default message",
    findMore: "Find more",
    goDashboard: "Dashboard",
    claimTitle: "Claim title",
    claimDescription: "Claim description",
    claimAction: "Claim",
    forfeitAction: "Forfeit",
    claimLoading: "Loading",
    authChecking: "Checking",
    claimSuccess: "Claimed",
    forfeitSuccess: "Forfeited",
    claimError: "Claim error",
    forfeitError: "Forfeit error",
    alreadySubmittedDescription: "Already submitted",
  },
}

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => mocks.searchParams,
}))

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => messages[namespace]?.[key] ?? key,
}))

describe("thank-you page", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{}", {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    )
  })

  it("prefers stored completion copy over locale defaults", async () => {
    writeResponseCompletionCopy("response-1", {
      title: "Custom title",
      message: "Custom message",
    })

    render(<ThankYouPage />)

    expect(await screen.findByText("Custom title")).toBeInTheDocument()
    expect(screen.getByText("Custom message")).toBeInTheDocument()
    expect(screen.getByTestId("thank-you-points")).toHaveTextContent("+6")
  })

  it("falls back to locale defaults when no stored copy exists", async () => {
    render(<ThankYouPage />)

    expect(await screen.findByText("Default title")).toBeInTheDocument()
    expect(screen.getByText("Default message")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId("thank-you-points")).toHaveTextContent("+6")
    })
  })
})
