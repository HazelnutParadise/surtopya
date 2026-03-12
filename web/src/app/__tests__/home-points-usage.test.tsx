import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  cookies: vi.fn(),
  getServerTranslator: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers,
  cookies: mocks.cookies,
}))

vi.mock("@/lib/i18n-server", () => ({
  getServerTranslator: mocks.getServerTranslator,
}))

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: ReactNode
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/components/navbar", () => ({
  Navbar: () => <div data-testid="navbar" />,
}))

vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => <div data-testid="site-footer" />,
}))

vi.mock("@/components/marketing/hero-three-background", () => ({
  HeroThreeBackground: () => <div data-testid="hero-three-background" />,
}))

vi.mock("@/components/motion", () => ({
  MotionReveal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageMotionShell: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

const homeMessages: Record<string, string> = {
  heroTitle: "Surtopya",
  heroSubtitle: "Survey platform",
  getStarted: "Get started",
  browseSurveys: "Browse surveys",
  browseDatasets: "Browse datasets",
  featureSectionTitle: "Features",
  featureSectionDescription: "Feature section",
  featureOneTitle: "Feature one",
  featureOneDescription: "Feature one description",
  featureTwoTitle: "Feature two",
  featureTwoDescription: "Feature two description",
  featureThreeTitle: "Feature three",
  featureThreeDescription: "Feature three description",
  gameplayTag: "How It Works",
  gameplaySectionTitle: "Simple gameplay, long-term data value",
  gameplaySectionDescription: "Gameplay section description",
  gameplayStepOneTitle: "Step one",
  gameplayStepOneDescription: "Step one description",
  gameplayStepTwoTitle: "Step two",
  gameplayStepTwoDescription: "Step two description",
  gameplayStepThreeTitle: "Step three",
  gameplayStepThreeDescription: "Step three description",
  pointsUsageTitle: "How to use points",
  pointsUsageDescription: "Use points to improve response quality, unlock paid data, and keep the earn-and-use loop running.",
  pointsUsageBoostTitle: "Boost rewards for respondents",
  pointsUsageBoostDescription: "When publishing a survey, allocate extra points that are paid to respondents who complete it.",
  pointsUsageDownloadTitle: "Download paid datasets",
  pointsUsageDownloadDescription: "Spend points to access premium datasets from the marketplace for faster analysis.",
  pointsUsageEarnTitle: "Answer to earn points back",
  pointsUsageEarnDescription: "Complete surveys to earn points, then reuse them for future research actions.",
  roleResearchersTitle: "For researchers",
  roleResearchersDescription: "For researchers description",
  roleParticipantsTitle: "For participants",
  roleParticipantsDescription: "For participants description",
}

describe("Home page points usage section", () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.headers.mockReset()
    mocks.cookies.mockReset()
    mocks.getServerTranslator.mockReset()

    mocks.headers.mockResolvedValue({
      get: (name: string) => (name === "x-locale" ? "en" : null),
    })
    mocks.cookies.mockResolvedValue({
      get: () => ({ value: "en" }),
    })
    mocks.getServerTranslator.mockResolvedValue((key: string) => homeMessages[key] ?? key)
  })

  it("renders a points usage section with respondent-focused boost copy", async () => {
    const { default: Home } = await import("@/app/page")
    render(await Home())

    expect(screen.getByText("How to use points")).toBeInTheDocument()
    expect(screen.getByText("Boost rewards for respondents")).toBeInTheDocument()
    expect(
      screen.getByText("When publishing a survey, allocate extra points that are paid to respondents who complete it.")
    ).toBeInTheDocument()
    expect(screen.getByText("Download paid datasets")).toBeInTheDocument()
    expect(screen.getByText("Answer to earn points back")).toBeInTheDocument()
  })
})
