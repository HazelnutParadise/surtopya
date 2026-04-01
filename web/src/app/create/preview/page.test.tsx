import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import PreviewPage from "@/app/create/preview/page"

const mocks = vi.hoisted(() => ({
  pathname: "/en/create/preview",
  push: vi.fn(),
  close: vi.fn(),
}))

const messages: Record<string, Record<string, string>> = {
  PreviewPage: {
    noPreviewDataTitle: "No preview data",
    noPreviewDataDescription: "Preview unavailable",
    backToBuilder: "Back to builder",
    exitPreview: "Exit preview",
  },
  SurveyPage: {
    previewCompleteTitle: "Preview complete",
    previewResultModalTitle: "Preview answers",
    previewResultBackToEdit: "Back to editing",
    previewResultOpenFullPage: "Open full page",
    previewResultBackToModal: "Back to dialog",
    privacyDescription: "Your responses are anonymous and used only for research purposes.",
  },
  Common: {
    cancel: "Cancel",
  },
}

const formatMessage = (template: string, values?: Record<string, string | number>) => {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
  usePathname: () => mocks.pathname,
}))

vi.mock("next-intl", () => ({
  useLocale: () => "en-US",
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string | number>) =>
    formatMessage(messages[namespace]?.[key] ?? key, values),
}))

vi.mock("@/components/survey/survey-renderer", () => ({
  SurveyRenderer: ({
    onComplete,
  }: {
    onComplete?: (answers: Record<string, unknown>) => void
  }) => (
    <button
      type="button"
      onClick={() =>
        onComplete?.({
          q1: { value: "Other", otherText: "Custom answer" },
        })
      }
    >
      Complete preview
    </button>
  ),
}))

describe("create preview page", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    mocks.push.mockReset()
    mocks.close.mockReset()
    vi.stubGlobal("close", mocks.close)

    window.sessionStorage.setItem(
      "preview_survey",
      JSON.stringify({
        id: "survey-1",
        title: "Preview survey",
        description: "Description",
        completionTitle: "Custom thanks",
        completionMessage: "We will review your answers soon.",
        settings: {
          isPublic: true,
          isResponseOpen: true,
          requireLoginToRespond: false,
          visibility: "public",
          isDatasetActive: true,
          pointsReward: 0,
        },
        questions: [
          {
            id: "q1",
            type: "single",
            title: "Favorite choice",
            required: false,
            options: [
              { label: "Regular" },
              { label: "Other", isOther: true, requireOtherText: true },
            ],
          },
        ],
      })
    )
    window.sessionStorage.setItem(
      "preview_theme",
      JSON.stringify({
        primaryColor: "#000000",
        backgroundColor: "#ffffff",
        fontFamily: "inter",
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows a rendered answer dialog first and can expand to a full page view", () => {
    render(<PreviewPage />)

    fireEvent.click(screen.getByRole("button", { name: "Complete preview" }))

    expect(screen.queryByText("Responses:")).not.toBeInTheDocument()
    expect(screen.queryByText(/\{/)).not.toBeInTheDocument()
    expect(screen.getByText("Preview answers")).toBeInTheDocument()
    expect(screen.getByText("Custom thanks")).toBeInTheDocument()
    expect(screen.getByText("We will review your answers soon.")).toBeInTheDocument()
    expect(screen.getByText("Favorite choice")).toBeInTheDocument()
    expect(screen.getByText("Custom answer")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Open full page" }))

    expect(screen.getByRole("button", { name: "Back to dialog" })).toBeInTheDocument()
    expect(screen.getByText("Favorite choice")).toBeInTheDocument()
    expect(screen.getByText("Custom answer")).toBeInTheDocument()
  })
})
