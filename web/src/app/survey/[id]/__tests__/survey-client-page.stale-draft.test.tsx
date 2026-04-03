import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SurveyClientPage } from "@/app/survey/[id]/survey-client-page"
import type { SurveyDisplay } from "@/lib/survey-mappers"

const mocks = vi.hoisted(() => ({
  pathname: "/en/survey/11111111-1111-1111-1111-111111111111",
  searchParams: new URLSearchParams(""),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
}))

const messages: Record<string, Record<string, string>> = {
  SurveyPage: {
    aboutTitle: "About this survey",
    questionPreviewTitle: "Question preview",
    privacyTitle: "Privacy",
    privacyDescription: "Privacy description",
    rewardLabel: "Reward",
    pointsValue: "{points} points",
    estimatedTime: "Estimated time",
    responsesLabel: "Responses",
    startSurvey: "Start survey",
    alreadySubmittedActionDisabled: "Already submitted",
    alreadySubmittedTitle: "Already submitted",
    alreadySubmittedDescription: "You have already submitted this survey.",
    backToMarketplace: "Back to marketplace",
    earnPoints: "Earn {points} points",
    progressNoticeMemberTitle: "Member progress",
    progressNoticeMemberDescription: "Drafts sync to your account.",
    progressNoticeGuestTitle: "Guest progress",
    progressNoticeGuestDescription: "Guest progress description",
    progressNoticeGuestAction: "Sign in",
    typeDescriptionDefault: "Answer questions",
    noQuestions: "No questions",
    responsesNotOpen: "Responses not open",
    loginRequiredToRespondDescription: "Login required",
    staleDraftDialogTitle: "Resume previous draft?",
    staleDraftDialogDescription:
      "This draft is from version {draftVersion}. The latest published version is {currentVersion}.",
    staleDraftContinueAction: "Continue old draft",
    staleDraftRestartAction: "Restart on latest version",
    staleDraftRestartDescription:
      "Restarting switches to the latest version and clears your previous draft answers.",
  },
  SurveyCard: {
    minutes: "{count} min",
  },
  Common: {
    loading: "Loading",
    error: "Something went wrong",
    saving: "Saving",
    cancel: "Cancel",
  },
}

const formatMessage = (template: string, values?: Record<string, string | number>) => {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.routerPush,
    replace: mocks.routerReplace,
  }),
  usePathname: () => mocks.pathname,
  useSearchParams: () => mocks.searchParams,
}))

vi.mock("next-intl", () => ({
  useLocale: () => "en-US",
  useTimeZone: () => "Asia/Taipei",
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string | number>) =>
    formatMessage(messages[namespace]?.[key] ?? key, values),
}))

vi.mock("@/components/navbar", () => ({
  Navbar: () => <div data-testid="navbar" />,
}))

vi.mock("@/components/survey/survey-renderer", () => ({
  SurveyRenderer: () => <div data-testid="survey-renderer" />,
}))

const baseSurvey: SurveyDisplay = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Survey Title",
  description: "Survey Description",
  questions: [
    {
      id: "q1",
      type: "short",
      title: "Your name",
      required: false,
    },
  ],
  settings: {
    isPublic: true,
    isResponseOpen: true,
    requireLoginToRespond: false,
    visibility: "public",
    isDatasetActive: true,
    pointsReward: 0,
    publishedCount: 2,
    currentPublishedVersionNumber: 2,
    hasUnpublishedChanges: false,
    isPublished: true,
  },
  responseCount: 12,
}

const authenticatedUser = {
  id: "user-1",
  pointsBalance: 0,
  monthlyPointsGrant: 0,
  membershipTier: "free",
  capabilities: {},
  locale: "en",
  publicProfile: {
    showDisplayName: true,
    showAvatar: true,
    showBio: true,
    showLocation: true,
    showPhone: true,
    showEmail: true,
  },
  createdAt: "2026-01-01T00:00:00Z",
  surveysCompleted: 0,
  isAdmin: false,
  isSuperAdmin: false,
}

const createAuthenticatedFetchMock = () =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url === "/api/app/me") {
      return new Response(JSON.stringify(authenticatedUser), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (url === `/api/app/surveys/${baseSurvey.id}/drafts/start`) {
      return new Response(
        JSON.stringify({
          id: "draft-stale",
          surveyVersionId: "version-1",
          surveyVersionNumber: 1,
          answers: [{ questionId: "q1", value: { text: "Saved draft answer" } }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    if (url === `/api/app/surveys/${baseSurvey.id}/drafts/restart`) {
      return new Response(
        JSON.stringify({
          id: "draft-latest",
          surveyVersionId: "version-2",
          surveyVersionNumber: 2,
          answers: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    return new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  })

describe("SurveyClientPage stale draft flow", () => {
  beforeEach(() => {
    mocks.routerPush.mockReset()
    mocks.routerReplace.mockReset()
    vi.stubGlobal("fetch", createAuthenticatedFetchMock())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("prompts for stale drafts and restarts on the latest version when selected", async () => {
    const fetchMock = createAuthenticatedFetchMock()
    vi.stubGlobal("fetch", fetchMock)

    render(<SurveyClientPage initialSurvey={baseSurvey} surveyId={baseSurvey.id} surveyBasePoints={1} />)

    fireEvent.click(await screen.findByRole("button", { name: "Start survey" }))

    expect(await screen.findByText("Resume previous draft?")).toBeInTheDocument()
    expect(screen.getByText("Continue old draft")).toBeInTheDocument()
    expect(screen.getByText("Restart on latest version")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Restart on latest version" }))

    await waitFor(() => {
      expect(screen.getByTestId("survey-renderer")).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/app/surveys/${baseSurvey.id}/drafts/start`,
      expect.objectContaining({ method: "POST" })
    )
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/app/surveys/${baseSurvey.id}/drafts/restart`,
      expect.objectContaining({ method: "POST" })
    )
  })
})
