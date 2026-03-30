import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SurveyManagementPage from "../page"

const openMock = vi.fn()

const commonMessages: Record<string, string> = {
  publish: "Publish",
  openResponses: "Open responses",
  closeResponses: "Close responses",
  error: "Error",
  loading: "Loading",
  saving: "Saving",
  cancel: "Cancel",
}

const surveyManagementMessages: Record<string, string> = {
  publishNewVersion: "Publish new version",
  publishConfirmTitle: "Confirm publish",
  publishConfirmDescription: "This will publish the current draft.",
  publishConfirmAction: "Confirm publish",
}

const surveyBuilderMessages: Record<string, string> = {
  versionHistory: "Version history",
  versionEmpty: "No versions",
  versionLoadFailed: "Failed to load versions",
  viewVersion: "View version",
  restoreToDraft: "Restore to draft",
  restoredToDraft: "Restored to draft",
  versionRestoreFailed: "Failed to restore version",
  restoreDraftConfirmTitle: "Restore version?",
  restoreDraftConfirmDescription: "This will overwrite your draft.",
  restoreDraftConfirmAction: "Restore",
  publishBlockedByLogicTitle: "Fix logic issues before publishing",
  publishBlockedByLogicDescription: "Drafts can keep invalid logic, but publishing is blocked until every broken logic rule is fixed.",
  logicWarningDeleted: "Logic jump points to a deleted question",
  untitledQuestion: "Untitled Question",
}

const commonTranslator = (key: string) => commonMessages[key] ?? key
const surveyManagementTranslator = (key: string) => surveyManagementMessages[key] ?? key
const surveyBuilderTranslator = (key: string, values?: Record<string, unknown>) =>
  key === "versionLabel" && values && typeof values.version === "number"
    ? `Version ${values.version}`
    : surveyBuilderMessages[key] ?? key

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "survey-1" }),
  usePathname: () => "/zh-TW/dashboard/surveys/survey-1",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    if (namespace === "Common") {
      return commonTranslator
    }

    if (namespace === "SurveyManagement") {
      return surveyManagementTranslator
    }

    if (namespace === "SurveyBuilder") {
      return surveyBuilderTranslator
    }

    return (key: string) => key
  },
  useTimeZone: () => "Asia/Taipei",
}))

vi.mock("@/components/survey/response-analytics-panel", () => ({
  ResponseAnalyticsPanel: () => <div data-testid="response-analytics-panel" />,
}))

vi.mock("@/components/survey/survey-response-summary-cards", () => ({
  SurveyResponseSummaryCards: () => <div data-testid="survey-response-summary-cards" />,
}))

vi.mock("@/components/survey/version-document-preview", () => ({
  VersionDocumentPreview: () => <div data-testid="version-document-preview" />,
}))

vi.mock("@/components/survey/survey-responses-export-menu", () => ({
  SurveyResponsesExportDialog: () => <div data-testid="survey-responses-export-dialog" />,
}))

vi.mock("@/lib/ui-telemetry", () => ({
  trackUIEvent: vi.fn(() => Promise.resolve()),
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

const baseQuestion = {
  id: "q-1",
  type: "short",
  title: "Question 1",
  required: true,
}

const buildSurveyPayload = (overrides?: Record<string, unknown>) => ({
  id: "survey-1",
  title: "Survey",
  description: "Description",
  visibility: "non-public",
  requireLoginToRespond: false,
  isResponseOpen: true,
  includeInDatasets: false,
  everPublic: false,
  publishedCount: 1,
  hasUnpublishedChanges: true,
  currentPublishedVersionNumber: 3,
  pointsReward: 0,
  responseCount: 1,
  createdAt: "2026-03-10T00:00:00Z",
  updatedAt: "2026-03-10T00:00:00Z",
  questions: [baseQuestion],
  ...overrides,
})

const buildVersionsPayload = (versionNumbers: number[]) => ({
  versions: versionNumbers.map((versionNumber) => ({
    id: `version-${versionNumber}`,
    surveyId: "survey-1",
    versionNumber,
    snapshot: {
      title: "Survey",
      description: "Description",
      visibility: "non-public",
      includeInDatasets: false,
      pointsReward: 0,
      questions: [baseQuestion],
    },
    pointsReward: 0,
    publishedAt: "2026-03-10T00:00:00Z",
    createdAt: "2026-03-10T00:00:00Z",
  })),
})

const buildJsonResponse = (body: unknown, ok = true) =>
  new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: {
      "Content-Type": "application/json",
    },
  })

describe("SurveyManagementPage publish new version", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.open = openMock
    let versionsFetchCount = 0

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString()

      if (url === "/api/app/surveys/survey-1" && !init?.method) {
        return Promise.resolve(buildJsonResponse(buildSurveyPayload()))
      }

      if (url === "/api/app/surveys/survey-1/responses" && !init?.method) {
        return Promise.resolve(buildJsonResponse({
          responses: [
            {
              id: "response-1",
              surveyId: "survey-1",
              surveyVersionId: "version-3",
              surveyVersionNumber: 3,
              status: "completed",
              pointsAwarded: 0,
              startedAt: "2026-03-10T00:00:00Z",
              completedAt: "2026-03-10T00:05:00Z",
              createdAt: "2026-03-10T00:00:00Z",
              answers: [],
            },
          ],
        }))
      }

      if (url === "/api/app/me") {
        return Promise.resolve(buildJsonResponse({ capabilities: {} }))
      }

      if (url === "/api/app/surveys/survey-1/versions" && !init?.method) {
        versionsFetchCount += 1
        return Promise.resolve(buildJsonResponse(buildVersionsPayload(versionsFetchCount > 1 ? [4, 3] : [3])))
      }

      if (url === "/api/app/surveys/survey-1/responses/analytics") {
        return Promise.resolve(buildJsonResponse({
          selectedVersion: "all",
          availableVersions: [3],
          summary: {
            totalCompletedResponses: 1,
            questionCount: 1,
            generatedAt: "2026-03-10T00:05:00Z",
          },
          pages: [],
          warnings: [],
        }))
      }

      if (url === "/api/app/surveys/survey-1/publish" && init?.method === "POST") {
        return Promise.resolve(buildJsonResponse(
          buildSurveyPayload({
            publishedCount: 2,
            currentPublishedVersionNumber: 4,
            hasUnpublishedChanges: false,
          })
        ))
      }

      throw new Error(`Unhandled fetch request: ${url}`)
    })

    global.fetch = fetchMock as unknown as typeof fetch
  })

  it("publishes a new version and reloads versions after success", async () => {
    render(<SurveyManagementPage />)

    const publishButton = await screen.findByRole("button", { name: "Publish new version" })
    fireEvent.click(publishButton)

    expect(await screen.findByRole("button", { name: "Confirm publish" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Confirm publish" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/app/surveys/survey-1/publish",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      )
    })

    await waitFor(() => {
      const versionCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url, init]) =>
          url === "/api/app/surveys/survey-1/versions" && !(init as RequestInit | undefined)?.method
      )
      expect(versionCalls).toHaveLength(2)
    })

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Publish new version" })).not.toBeInTheDocument()
    })
  })

  it("does not publish when the confirmation dialog is canceled", async () => {
    render(<SurveyManagementPage />)

    const publishButton = await screen.findByRole("button", { name: "Publish new version" })
    fireEvent.click(publishButton)

    expect(await screen.findByRole("button", { name: "Confirm publish" })).toBeInTheDocument()

    const publishCallsBeforeCancel = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url, init]) =>
        url === "/api/app/surveys/survey-1/publish" &&
        (init as RequestInit | undefined)?.method === "POST"
    )
    expect(publishCallsBeforeCancel).toHaveLength(0)

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    const publishCallsAfterCancel = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url, init]) =>
        url === "/api/app/surveys/survey-1/publish" &&
        (init as RequestInit | undefined)?.method === "POST"
    )
    expect(publishCallsAfterCancel).toHaveLength(0)
  })

  it("opens version preview dialog and keeps version list scrollable", async () => {
    render(<SurveyManagementPage />)

    const versionList = await screen.findByTestId("survey-version-history-list")
    expect(versionList).toHaveClass("max-h-[22rem]")
    expect(versionList).toHaveClass("overflow-y-auto")
    expect(screen.queryByTestId("version-document-preview")).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId("survey-version-view-3"))

    expect(await screen.findByTestId("version-document-preview")).toBeInTheDocument()
  })

  it("blocks publish from survey management when the draft has invalid logic", async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString()

      if (url === "/api/app/surveys/survey-1" && !init?.method) {
        return Promise.resolve(buildJsonResponse(buildSurveyPayload({
          questions: [
            {
              id: "q-logic",
              type: "single",
              title: "Logic question",
              required: false,
              options: [{ id: "opt-1", label: "Option 1" }],
              logic: [
                {
                  operator: "or",
                  conditions: [{ optionId: "opt-1", match: "includes" }],
                  destinationQuestionId: "missing-question",
                },
              ],
            },
          ],
        })))
      }

      if (url === "/api/app/surveys/survey-1/responses" && !init?.method) {
        return Promise.resolve(buildJsonResponse({ responses: [] }))
      }

      if (url === "/api/app/me") {
        return Promise.resolve(buildJsonResponse({ capabilities: {} }))
      }

      if (url === "/api/app/surveys/survey-1/versions" && !init?.method) {
        return Promise.resolve(buildJsonResponse(buildVersionsPayload([3])))
      }

      if (url === "/api/app/surveys/survey-1/responses/analytics") {
        return Promise.resolve(buildJsonResponse({
          selectedVersion: "all",
          availableVersions: [3],
          summary: {
            totalCompletedResponses: 0,
            questionCount: 1,
            generatedAt: "2026-03-10T00:05:00Z",
          },
          pages: [],
          warnings: [],
        }))
      }

      if (url === "/api/app/surveys/survey-1/publish" && init?.method === "POST") {
        return Promise.resolve(buildJsonResponse({ error: "should not publish" }, false))
      }

      throw new Error(`Unhandled fetch request: ${url}`)
    })

    render(<SurveyManagementPage />)

    const publishButton = await screen.findByRole("button", { name: "Publish new version" })
    expect(publishButton).toBeDisabled()
    expect(await screen.findByText("Fix logic issues before publishing")).toBeInTheDocument()
    expect(screen.getByText("Logic jump points to a deleted question")).toBeInTheDocument()

    const publishCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url, init]) =>
        url === "/api/app/surveys/survey-1/publish" &&
        (init as RequestInit | undefined)?.method === "POST"
    )
    expect(publishCalls).toHaveLength(0)
  })
})
