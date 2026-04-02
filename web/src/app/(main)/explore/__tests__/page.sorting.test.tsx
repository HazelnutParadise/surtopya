import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { InputHTMLAttributes, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams("sort=recommended"),
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
  getRuntimeConfig: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.routerReplace,
    push: mocks.routerPush,
  }),
  useSearchParams: () => mocks.searchParams,
  usePathname: () => "/en/explore",
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfig: mocks.getRuntimeConfig,
}))

vi.mock("@/components/motion", () => ({
  MotionReveal: ({ children }: { children: ReactNode }) => <>{children}</>,
  PageMotionShell: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
}))

vi.mock("lucide-react", () => ({
  Search: () => null,
  ArrowUpDown: () => null,
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: { children: ReactNode }) => <button {...props}>{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/survey-card", () => ({
  SurveyCard: ({
    title,
    hasResponded,
    points,
  }: {
    title: string
    hasResponded?: boolean
    points?: number
  }) => (
    <div data-testid="survey-card">
      {title}:{hasResponded ? "responded" : "fresh"}:{points ?? 0}
    </div>
  ),
}))

import ExplorePage from "@/app/(main)/explore/page"

type SurveyFixture = {
  id: string
  title: string
  description: string
  visibility: "public"
  requireLoginToRespond: boolean
  isResponseOpen: boolean
  includeInDatasets: boolean
  publishedCount: number
  hasUnpublishedChanges: boolean
  pointsReward: number
  responseCount: number
  createdAt: string
  updatedAt: string
  publishedAt: string
  hasResponded: boolean
}

function makeSurvey(id: string, title: string, hasResponded: boolean): SurveyFixture {
  return {
    id,
    title,
    description: `${title} desc`,
    visibility: "public",
    requireLoginToRespond: false,
    isResponseOpen: true,
    includeInDatasets: true,
    publishedCount: 1,
    hasUnpublishedChanges: false,
    pointsReward: 6,
    responseCount: 10,
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
    publishedAt: "2026-03-01T00:00:00Z",
    hasResponded,
  }
}

describe("Explore page sorting behavior", () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams("sort=recommended")
    mocks.routerReplace.mockReset()
    mocks.routerPush.mockReset()
    mocks.getRuntimeConfig.mockReset()
    mocks.getRuntimeConfig.mockResolvedValue({ surveyBasePoints: 1 })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("refetches first page with new sort and resets pagination offset", async () => {
    const firstPageSurveys = Array.from({ length: 24 }, (_, index) =>
      makeSurvey(`s-${index + 1}`, `S${index + 1}`, index % 2 === 1)
    )

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ surveys: firstPageSurveys }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ surveys: [makeSurvey("c", "C", false)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ surveys: [makeSurvey("n1", "N1", false)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

    vi.stubGlobal("fetch", fetchMock)

    const { rerender } = render(<ExplorePage />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/app/surveys/public?limit=24&offset=0&sort=recommended",
        expect.objectContaining({ cache: "no-store" })
      )
    })

    fireEvent.click(await screen.findByRole("button", { name: "loadMore" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/app/surveys/public?limit=24&offset=24&sort=recommended",
        expect.objectContaining({ cache: "no-store" })
      )
    })

    mocks.searchParams = new URLSearchParams("sort=newest")
    rerender(<ExplorePage />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/app/surveys/public?limit=24&offset=0&sort=newest",
        expect.objectContaining({ cache: "no-store" })
      )
    })
  })

  it("keeps backend recommended order where unanswered surveys are shown before answered ones", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          surveys: [makeSurvey("fresh-1", "Fresh First", false), makeSurvey("done-1", "Done Later", true)],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    render(<ExplorePage />)

    const cards = await screen.findAllByTestId("survey-card")
    expect(cards[0]?.textContent).toBe("Fresh First:fresh:3")
    expect(cards[1]?.textContent).toBe("Done Later:responded:3")
  })

  it("shows the base survey point immediately even before runtime config resolves", async () => {
    mocks.getRuntimeConfig.mockReturnValue(
      new Promise(() => {})
    )

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          surveys: [makeSurvey("boosted-1", "Boosted Survey", false)],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    render(<ExplorePage />)

    expect(await screen.findByTestId("survey-card")).toHaveTextContent("Boosted Survey:fresh:3")
  })
})
