// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import AdminPage from "../page"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (key === "surveyMeta") {
      return `${values?.responses} responses / ${values?.points} points`
    }
    if (key === "authorBy") {
      return `By ${values?.name}`
    }
    return key
  },
  useTimeZone: () => "Asia/Taipei",
}))

vi.mock("@/lib/ui-telemetry", () => ({
  trackUIEvent: vi.fn(() => Promise.resolve()),
}))

vi.mock("@/lib/points-balance-events", () => ({
  notifyPointsBalanceChanged: vi.fn(),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open = false }: { children: ReactNode; open?: boolean }) => (
    <div>{open ? children : null}</div>
  ),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/switch", () => ({
  Switch: () => <button type="button">switch</button>,
}))

const buildJsonResponse = (body: unknown, ok = true) =>
  new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  })

describe("AdminPage survey reward display", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const fetchMock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString()

      if (url === "/api/app/me") {
        return Promise.resolve(
          buildJsonResponse({
            id: "user-1",
            pointsBalance: 0,
            monthlyPointsGrant: 0,
            membershipTier: "free",
            capabilities: {},
            locale: "zh-TW",
            createdAt: "2026-03-10T00:00:00Z",
            surveysCompleted: 0,
            isAdmin: true,
            isSuperAdmin: true,
          })
        )
      }
      if (url.startsWith("/api/app/admin/surveys?")) {
        return Promise.resolve(
          buildJsonResponse({
            surveys: [
              {
                id: "survey-1",
                title: "Reward Survey",
                description: "Description",
                visibility: "public",
                requireLoginToRespond: false,
                isResponseOpen: true,
                includeInDatasets: false,
                everPublic: true,
                publishedCount: 1,
                hasUnpublishedChanges: false,
                pointsReward: 6,
                responseCount: 3,
                createdAt: "2026-03-10T00:00:00Z",
                updatedAt: "2026-03-10T00:00:00Z",
                author: {
                  id: "author-1",
                  slug: "author-a",
                  displayName: "Author A",
                  avatarUrl: null,
                },
              },
            ],
          })
        )
      }
      if (url.startsWith("/api/app/admin/datasets?")) {
        return Promise.resolve(buildJsonResponse({ datasets: [] }))
      }
      if (url.startsWith("/api/app/admin/deid/reviews?")) {
        return Promise.resolve(buildJsonResponse({ jobs: [] }))
      }
      if (url.startsWith("/api/app/admin/users?")) {
        return Promise.resolve(buildJsonResponse({ users: [] }))
      }
      if (url.startsWith("/api/app/admin/agents?")) {
        return Promise.resolve(buildJsonResponse({ accounts: [] }))
      }
      if (url === "/api/app/admin/policies") {
        return Promise.resolve(buildJsonResponse({ tiers: [], capabilities: [], matrix: [] }))
      }
      if (url === "/api/app/admin/policy-writers") {
        return Promise.resolve(buildJsonResponse({ users: [] }))
      }
      if (url === "/api/app/admin/system-settings") {
        return Promise.resolve(buildJsonResponse({ surveyBasePoints: 5, signupInitialPoints: 0 }))
      }

      throw new Error(`Unhandled fetch request: ${url}`)
    })

    global.fetch = fetchMock as unknown as typeof fetch
  })

  it("shows respondent-visible reward instead of raw boost spend in the survey list", async () => {
    render(<AdminPage />)

    await screen.findByText("Reward Survey")
    expect(await screen.findByText("3 responses / 7 points")).toBeInTheDocument()
  })
})
