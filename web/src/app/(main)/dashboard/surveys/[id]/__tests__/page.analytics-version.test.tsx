// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SurveyManagementPage from "../page"

const commonMessages: Record<string, string> = {
  loading: "Loading",
}

const surveyManagementMessages: Record<string, string> = {}

const surveyBuilderMessages: Record<string, string> = {}

const commonTranslator = (key: string) => commonMessages[key] ?? key
const surveyManagementTranslator = (key: string) => surveyManagementMessages[key] ?? key
const surveyBuilderTranslator = (key: string) => surveyBuilderMessages[key] ?? key

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
  ResponseAnalyticsPanel: ({
    analytics,
    loading,
    error,
    selectedVersion,
    onVersionChange,
  }: {
    analytics: { summary?: { totalCompletedResponses?: number } } | null
    loading: boolean
    error: string | null
    selectedVersion: string
    onVersionChange: (value: string) => void
  }) => (
    <div>
      <label htmlFor="analytics-version">version</label>
      <select
        id="analytics-version"
        data-testid="analytics-version"
        value={selectedVersion}
        onChange={(event) => onVersionChange(event.target.value)}
      >
        <option value="all">all</option>
        <option value="1">1</option>
      </select>
      {loading ? <div data-testid="analytics-loading">loading</div> : null}
      {error ? <div data-testid="analytics-error">{error}</div> : null}
      <div data-testid="analytics-count">{analytics?.summary?.totalCompletedResponses ?? 0}</div>
    </div>
  ),
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

const baseQuestion = {
  id: "q-1",
  type: "short",
  title: "Question 1",
  required: true,
}

const buildSurveyPayload = () => ({
  id: "survey-1",
  title: "Survey",
  description: "Description",
  completionTitle: "Dashboard thanks",
  completionMessage: "Dashboard follow-up",
  visibility: "non-public",
  requireLoginToRespond: false,
  isResponseOpen: true,
  includeInDatasets: false,
  everPublic: false,
  publishedCount: 1,
  hasUnpublishedChanges: false,
  currentPublishedVersionNumber: 3,
  pointsReward: 0,
  responseCount: 1,
  createdAt: "2026-03-10T00:00:00Z",
  updatedAt: "2026-03-10T00:00:00Z",
  questions: [baseQuestion],
})

const buildJsonResponse = (body: unknown, ok = true) =>
  new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: {
      "Content-Type": "application/json",
    },
  })

describe("SurveyManagementPage analytics version switching", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString()

      if (url === "/api/app/surveys/survey-1" && !init?.method) {
        return Promise.resolve(buildJsonResponse(buildSurveyPayload()))
      }

      if (url === "/api/app/surveys/survey-1/responses" && !init?.method) {
        return Promise.resolve(buildJsonResponse({ responses: [] }))
      }

      if (url === "/api/app/me") {
        return Promise.resolve(buildJsonResponse({ capabilities: {}, pointsBalance: 999 }))
      }

      if (url === "/api/app/surveys/survey-1/versions" && !init?.method) {
        return Promise.resolve(
          buildJsonResponse({
            versions: [
              {
                id: "version-3",
                surveyId: "survey-1",
                versionNumber: 3,
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
              },
            ],
          })
        )
      }

      if (url === "/api/app/surveys/survey-1/responses/analytics") {
        return Promise.resolve(
          buildJsonResponse({
            selectedVersion: "all",
            availableVersions: [3, 1],
            summary: {
              totalCompletedResponses: 3,
              questionCount: 1,
              generatedAt: "2026-03-10T00:05:00Z",
            },
            pages: [],
            warnings: [],
          })
        )
      }

      if (url === "/api/app/surveys/survey-1/responses/analytics?version=1") {
        return Promise.resolve(
          buildJsonResponse({
            selectedVersion: "1",
            availableVersions: [3, 1],
            summary: {
              totalCompletedResponses: 1,
              questionCount: 1,
              generatedAt: "2026-03-10T00:06:00Z",
            },
            pages: [],
            warnings: [],
          })
        )
      }

      throw new Error(`Unhandled fetch request: ${url}`)
    })

    global.fetch = fetchMock as unknown as typeof fetch
  })

  it("refetches analytics with the selected version and updates the rendered summary", async () => {
    render(<SurveyManagementPage />)

    await waitFor(() => {
      expect(screen.getByTestId("analytics-count")).toHaveTextContent("3")
    })

    fireEvent.change(screen.getByTestId("analytics-version"), {
      target: { value: "1" },
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/app/surveys/survey-1/responses/analytics?version=1",
        expect.objectContaining({
          cache: "no-store",
          signal: expect.any(AbortSignal),
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId("analytics-count")).toHaveTextContent("1")
    })
  })
})
