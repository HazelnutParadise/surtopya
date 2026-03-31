import { fireEvent, render, screen } from "@testing-library/react"
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
    progressNoticeGuestTitle: "Guest progress",
    progressNoticeGuestDescription: "Guest progress description",
    progressNoticeGuestAction: "Sign in",
    typeDescriptionDefault: "Answer questions",
    noQuestions: "No questions",
    responsesNotOpen: "Responses not open",
    loginRequiredToRespondDescription: "Login required",
    previewCompleteTitle: "Preview complete",
    previewCompleteDescription: "Preview description",
    previewCompleteResponses: "Preview responses",
    takingGuestNotice: "Guest answers are saved on this device.",
    takingGuestNoticeAction: "Sign in to sync",
    leaveDialogGuestSavedTitle: "Saved locally",
    leaveDialogSavedTitle: "Saved",
    leaveDialogFailedTitle: "Save failed",
    leaveDialogGuestSavedDescription: "Saved locally",
    leaveDialogSavedDescription: "Saved",
    leaveDialogFailedDescription: "Failed",
    keepEditing: "Keep editing",
    exitPreview: "Exit preview",
    exitSurvey: "Exit survey",
    notFoundTitle: "Not found",
    notFoundDescription: "Survey not found",
    notFoundPreviewDescription: "Preview not found",
    backToBuilder: "Back to builder",
    loginToRespond: "Login to respond",
  },
  SurveyRenderer: {
    requiredAlert: "Please complete required questions.",
    otherTextRequiredAlert: 'Please add details for "{question}".',
    otherTextRequiredHint: "Please fill in the details before continuing.",
    minSelectionsAlert: 'Select at least {count} options for "{question}".',
    maxSelectionsAlert: 'Select no more than {count} options for "{question}".',
    previewBanner: "Preview mode",
    pageProgress: "Page {current} / {total}",
    percentComplete: "{percent}%",
    requiredLabel: "Required",
    textPlaceholder: "Type here",
    selectPlaceholder: "Select one",
    back: "Back",
    submit: "Submit",
    next: "Next",
    otherTextPlaceholder: "Please specify",
  },
  SurveyCard: {
    minutes: "{count} min",
  },
  QuestionTypes: {
    single: "Single choice",
    multi: "Multiple choice",
    text: "Text",
    short: "Short answer",
    long: "Long answer",
    rating: "Rating",
    date: "Date",
    select: "Select",
    section: "Page",
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

const baseSurvey: SurveyDisplay = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Survey Title",
  description: "Survey Description",
  questions: [],
  settings: {
    isPublic: true,
    isResponseOpen: true,
    requireLoginToRespond: false,
    visibility: "public",
    isDatasetActive: true,
    pointsReward: 0,
    publishedCount: 1,
    hasUnpublishedChanges: false,
    isPublished: true,
  },
  responseCount: 12,
}

const createFetchMock = () =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url === "/api/app/me") {
      return new Response("{}", {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (url.includes("/responses/submit-anonymous")) {
      return new Response(
        JSON.stringify({
          pointsAwarded: 0,
          response: { id: "response-1" },
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

const renderStartedSurvey = async (survey: SurveyDisplay) => {
  render(<SurveyClientPage initialSurvey={survey} surveyId={survey.id} surveyBasePoints={1} />)

  fireEvent.click(await screen.findByRole("button", { name: "Start survey" }))
}

describe("SurveyClientPage validation integration", () => {
  beforeEach(() => {
    mocks.routerPush.mockReset()
    mocks.routerReplace.mockReset()
    sessionStorage.clear()
    vi.stubGlobal("fetch", createFetchMock())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("matches preview-style inline validation for required short answers in the taking flow", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await renderStartedSurvey({
      ...baseSurvey,
      questions: [
        {
          id: "q1",
          type: "short",
          title: "Your name",
          required: true,
        },
      ],
    })

    const input = await screen.findByPlaceholderText("Type here")

    fireEvent.change(input, { target: { value: "Alice" } })
    fireEvent.change(input, { target: { value: "   " } })

    expect(screen.getByTestId("survey-question-error-q1")).toHaveTextContent(
      "Please complete required questions."
    )
    expect(screen.getByTestId("survey-question-q1")).toHaveAttribute("data-invalid", "true")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("shows inline submit-time errors on the real survey page before anonymous submission", async () => {
    const fetchMock = createFetchMock()
    vi.stubGlobal("fetch", fetchMock)

    await renderStartedSurvey({
      ...baseSurvey,
      questions: [
        {
          id: "q1",
          type: "short",
          title: "Your name",
          required: true,
        },
      ],
    })

    fireEvent.click(screen.getByRole("button", { name: "Submit" }))

    expect(screen.getByTestId("survey-question-error-q1")).toHaveTextContent(
      "Please complete required questions."
    )
    expect(screen.getByPlaceholderText("Type here")).toHaveAttribute("aria-invalid", "true")
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/responses/submit-anonymous"),
      expect.anything()
    )
  })

  it("keeps other-text and multi-select inline validation consistent on the real survey page", async () => {
    await renderStartedSurvey({
      ...baseSurvey,
      questions: [
        {
          id: "q1",
          type: "single",
          title: "Favorite option",
          required: true,
          options: [
            { id: "regular", label: "Regular" },
            { id: "other", label: "Can add details", isOther: true, requireOtherText: true },
          ],
        },
        {
          id: "q2",
          type: "multi",
          title: "Choose options",
          required: true,
          minSelections: 2,
          maxSelections: 2,
          options: ["A", "B", "C"],
        },
      ],
    })

    fireEvent.click(screen.getByText("Can add details"))

    const otherInput = await screen.findByPlaceholderText("Please specify")
    expect(otherInput).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByText("Please fill in the details before continuing.")).toBeInTheDocument()

    fireEvent.change(otherInput, { target: { value: "Extra detail" } })
    expect(screen.queryByText("Please fill in the details before continuing.")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("A"))
    expect(screen.getByTestId("survey-question-error-q2")).toHaveTextContent(
      'Select at least 2 options for "Choose options".'
    )

    fireEvent.click(screen.getByText("B"))
    expect(screen.queryByTestId("survey-question-error-q2")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("C"))
    expect(screen.getByTestId("survey-question-error-q2")).toHaveTextContent(
      'Select no more than 2 options for "Choose options".'
    )
  })
})
