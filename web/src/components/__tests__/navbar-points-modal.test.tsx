import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Navbar } from "@/components/navbar"
import { pointsBalanceChangedEvent } from "@/lib/points-balance-events"

const mocks = vi.hoisted(() => ({
  pathname: "/en/explore",
}))

const messages: Record<string, Record<string, string>> = {
  Navigation: {
    explore: "Explore",
    datasets: "Datasets",
    pricing: "Pricing",
    about: "About",
    create: "Create",
    login: "Log in",
    getStarted: "Get started",
    closeMenu: "Close menu",
    openMenu: "Open menu",
    dashboard: "Dashboard",
    profile: "Profile",
    settings: "Settings",
    logout: "Log out",
    admin: "Admin",
  },
  Dashboard: {
    pointsBalance: "Points balance",
    pointsModalOpen: "Open points details",
    pointsModalTitle: "Points Balance",
    pointsModalDescription: "Track your points, monthly grant timing, and where points can be used.",
    pointsModalMonthlyGrant: "Monthly grant: {points} points",
    pointsModalNoMonthlyGrant: "Your current membership does not include a monthly points grant.",
    pointsModalCountdownDays: "Days",
    pointsModalCountdownHours: "Hours",
    pointsModalCountdownMinutes: "Minutes",
    pointsModalCountdownSeconds: "Seconds",
    pointsModalGrantingSoon: "Monthly grant is being issued soon.",
    pointsModalWhatForTitle: "What can points do?",
    pointsModalUseBoost: "Add extra points for respondents when publishing surveys.",
    pointsModalUseDataset: "Download paid datasets from the marketplace.",
    pointsModalUseEarn: "Complete surveys to earn more points.",
  },
}

const formatMessage = (template: string, values?: Record<string, string | number>) => {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))
}

const translationFor = (namespace: string, key: string, values?: Record<string, string | number>) => {
  const template = messages[namespace]?.[key] ?? key
  return formatMessage(template, values)
}

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}))

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string | number>) =>
    translationFor(namespace, key, values),
}))

const buildProfile = (overrides?: Partial<Record<string, unknown>>) => ({
  id: "user-1",
  email: "user@example.com",
  displayName: "User",
  pointsBalance: 1280,
  nextMonthlyPointsGrantAt: "2030-04-01T00:00:00Z",
  monthlyPointsGrant: 120,
  membershipTier: "pro",
  capabilities: {},
  locale: "en",
  createdAt: "2030-01-01T00:00:00Z",
  surveysCompleted: 3,
  isAdmin: false,
  isSuperAdmin: false,
  ...overrides,
})

describe("Navbar points modal", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(buildProfile()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("opens the points modal from the desktop points card and shows countdown labels", async () => {
    render(<Navbar />)

    fireEvent.click(await screen.findByTestId("navbar-points-desktop"))

    expect(await screen.findByTestId("navbar-points-modal")).toBeInTheDocument()
    expect(screen.getByText("Monthly grant: 120 points")).toBeInTheDocument()
    expect(screen.getByText("Days")).toBeInTheDocument()
    expect(screen.getByText("Hours")).toBeInTheDocument()
    expect(screen.getByText("Minutes")).toBeInTheDocument()
    expect(screen.getByText("Seconds")).toBeInTheDocument()
  })

  it("opens the points modal from the mobile points card", async () => {
    render(<Navbar />)

    fireEvent.click(await screen.findByTestId("navbar-points-mobile"))

    expect(await screen.findByTestId("navbar-points-modal")).toBeInTheDocument()
    expect(screen.getByText("What can points do?")).toBeInTheDocument()
    expect(screen.getByText("Add extra points for respondents when publishing surveys.")).toBeInTheDocument()
  })

  it("shows no-monthly-grant fallback text when the membership has no monthly grant", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify(
            buildProfile({
              monthlyPointsGrant: 0,
              nextMonthlyPointsGrantAt: undefined,
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    )

    render(<Navbar />)

    fireEvent.click(await screen.findByTestId("navbar-points-desktop"))

    expect(await screen.findByTestId("navbar-points-modal-no-grant")).toHaveTextContent(
      "Your current membership does not include a monthly points grant."
    )
  })

  it("refreshes points immediately when points changed event is dispatched", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildProfile({
              pointsBalance: 100,
            })
          ),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildProfile({
              pointsBalance: 250,
            })
          ),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    vi.stubGlobal("fetch", fetchMock)

    render(<Navbar />)

    await waitFor(() => {
      expect(screen.getByTestId("navbar-points-desktop")).toHaveTextContent("100")
    })
    window.dispatchEvent(new CustomEvent(pointsBalanceChangedEvent))

    await waitFor(() => {
      expect(screen.getByTestId("navbar-points-desktop")).toHaveTextContent("250")
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
