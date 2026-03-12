import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SurveyManagementPage from "../page"

const {
  pushMock,
  replaceMock,
  openMock,
  trackUIEventMock,
  commonTranslator,
  surveyManagementTranslator,
  surveyBuilderTranslator,
} = vi.hoisted(() => {
  const commonMessages: Record<string, string> = {
    publish: "發布",
    openResponses: "開啟回應",
    closeResponses: "關閉回應",
    error: "發生錯誤",
    loading: "載入中",
    saving: "儲存中",
    cancel: "取消",
  }

  const surveyManagementMessages: Record<string, string> = {
    publishNewVersion: "發布新版本",
    previewSurvey: "預覽問卷",
    editSurvey: "編輯問卷",
    openSurveyPage: "開啟問卷頁面",
    deleteSurvey: "刪除問卷",
    responses: "回應",
    settings: "設定",
    shareLink: "分享連結",
    quickActions: "快速操作",
    responsesTableId: "ID",
    responsesTableStatus: "狀態",
    responsesTableRespondent: "作答者",
    responsesTablePoints: "點數",
    responsesTableStartedAt: "開始時間",
    responsesTableSubmittedAt: "提交時間",
    deleteSurveyConfirm: "確認刪除",
    visibilityLabel: "可見性",
    public: "公開",
    nonPublic: "不公開",
    visibilityPublicDescription: "公開",
    visibilityNonPublicDescription: "不公開",
    datasetProgramLabel: "資料集",
    datasetProgramPublicDescription: "公開描述",
    datasetProgramNonPublicDescription: "非公開描述",
    settingsLockedAfterPublish: "已鎖定",
    expirationDate: "到期時間",
    expirationHint: "提示",
    pointsReward: "點數獎勵",
    pointsRewardDescription: "點數說明",
    notPublishedYet: "尚未發布",
    responseStatusHint: "發布會建立新版本；開啟/關閉回應是獨立操作。",
  }

  const surveyBuilderMessages: Record<string, string> = {
    versionHistory: "版本紀錄",
    versionEmpty: "沒有版本",
    versionLoadFailed: "載入版本失敗",
    viewVersion: "查看版本",
    restoreToDraft: "還原到草稿",
    restoredToDraft: "已還原到草稿",
    versionRestoreFailed: "還原失敗",
    restoreDraftConfirmTitle: "確認還原",
    restoreDraftConfirmDescription: "確認還原描述",
    restoreDraftConfirmAction: "確認還原",
    surveyTitle: "問卷標題",
    description: "描述",
    descriptionPlaceholder: "描述",
    supportsMarkdown: "支援 Markdown",
    requireLoginToRespondLabel: "需登入",
    requireLoginToRespondDescription: "需要登入才能作答",
    formatBold: "粗體",
    formatItalic: "斜體",
    formatLink: "連結",
    formatBulletList: "清單",
    linkPrompt: "輸入連結",
    linkText: "連結",
    publishErrorActiveSurveyLimitReached: "超過上限",
    noChangesToPublish: "沒有變更可發布",
    responsesClosed: "回應已關閉",
    publishedVersionExpired: "版本已過期",
  }

  return {
    pushMock: vi.fn(),
    replaceMock: vi.fn(),
    openMock: vi.fn(),
    trackUIEventMock: vi.fn(() => Promise.resolve()),
    commonTranslator: (key: string) => commonMessages[key] ?? key,
    surveyManagementTranslator: (key: string) => surveyManagementMessages[key] ?? key,
    surveyBuilderTranslator: (key: string, values?: Record<string, unknown>) =>
      key === "versionLabel" && values && typeof values.version === "number"
        ? `版本 ${values.version}`
        : surveyBuilderMessages[key] ?? key,
  }
})

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "survey-1" }),
  usePathname: () => "/zh-TW/dashboard/surveys/survey-1",
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
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
  trackUIEvent: trackUIEventMock,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const baseQuestion = {
  id: "q-1",
  type: "short",
  title: "問題 1",
  required: true,
}

const buildSurveyPayload = (overrides?: Record<string, unknown>) => ({
  id: "survey-1",
  title: "問卷",
  description: "描述",
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
      title: "問卷",
      description: "描述",
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

const buildJsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: vi.fn().mockResolvedValue(body),
})

describe("SurveyManagementPage publish new version", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.open = openMock

    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>

      if (url === "/api/surveys/survey-1" && !init?.method) {
        return Promise.resolve(buildJsonResponse(buildSurveyPayload()))
      }

      if (url === "/api/surveys/survey-1/responses" && !init?.method) {
        return Promise.resolve(
          buildJsonResponse({
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
          })
        )
      }

      if (url === "/api/me") {
        return Promise.resolve(buildJsonResponse({ capabilities: {} }))
      }

      if (url === "/api/surveys/survey-1/versions" && !init?.method) {
        const callCount = fetchMock.mock.calls.filter(
          ([calledUrl, calledInit]) =>
            calledUrl === "/api/surveys/survey-1/versions" && !(calledInit as RequestInit | undefined)?.method
        ).length
        return Promise.resolve(buildJsonResponse(buildVersionsPayload(callCount > 1 ? [4, 3] : [3])))
      }

      if (url === "/api/surveys/survey-1/responses/analytics") {
        return Promise.resolve(
          buildJsonResponse({
            selectedVersion: "all",
            availableVersions: [3],
            summary: {
              totalCompletedResponses: 1,
              questionCount: 1,
              generatedAt: "2026-03-10T00:05:00Z",
            },
            pages: [],
            warnings: [],
          })
        )
      }

      if (url === "/api/surveys/survey-1/publish" && init?.method === "POST") {
        return Promise.resolve(
          buildJsonResponse(
            buildSurveyPayload({
              publishedCount: 2,
              currentPublishedVersionNumber: 4,
              hasUnpublishedChanges: false,
            })
          )
        )
      }

      throw new Error(`Unhandled fetch request: ${url}`)
    }) as typeof fetch
  })

  it("publishes a new version and reloads versions after success", async () => {
    render(<SurveyManagementPage />)

    const publishButton = await screen.findByRole("button", { name: "發布新版本" })
    fireEvent.click(publishButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/surveys/survey-1/publish",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      )
    })

    await waitFor(() => {
      const versionCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url, init]) =>
          url === "/api/surveys/survey-1/versions" && !(init as RequestInit | undefined)?.method
      )
      expect(versionCalls).toHaveLength(2)
    })

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "發布新版本" })).not.toBeInTheDocument()
    })
  })
})
