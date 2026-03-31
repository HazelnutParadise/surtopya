import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SurveyClientPage } from "@/app/survey/[id]/survey-client-page"
import type { SurveyDisplay } from "@/lib/survey-mappers"

const mocks = vi.hoisted(() => ({
  pathname: "/zh-TW/survey/11111111-1111-1111-1111-111111111111",
  searchParams: new URLSearchParams(""),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
}))

const messages: Record<string, Record<string, string>> = {
  SurveyPage: {
    aboutTitle: "關於此問卷",
    questionPreviewTitle: "你將被詢問的內容",
    privacyTitle: "隱私與資料",
    privacyDescription: "你的回應將匿名，僅用於研究。",
    rewardLabel: "回饋",
    pointsValue: "{points} 點",
    estimatedTime: "預估時間",
    responsesLabel: "回應數",
    startSurvey: "開始問卷",
    alreadySubmittedActionDisabled: "已填過",
    alreadySubmittedTitle: "你已完成這份問卷",
    alreadySubmittedDescription: "你已填過這份問卷，無法再次提交。",
    backToMarketplace: "返回市場",
    earnPoints: "獲得 {points} 點",
    progressNoticeGuestTitle: "訪客進度只會暫存在此瀏覽器。",
    progressNoticeGuestDescription: "登入後可跨裝置保留進度。",
    progressNoticeGuestAction: "登入並保留進度",
    typeDescriptionDefault: "題目",
    noQuestions: "沒有可預覽的題目。",
  },
  SurveyCard: {
    minutes: "{count} 分鐘",
  },
  Common: {
    loading: "載入中",
    error: "發生錯誤",
    saving: "儲存中",
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
  useLocale: () => "zh-TW",
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

describe("SurveyClientPage already-submitted pre-disable", () => {
  beforeEach(() => {
    mocks.routerPush.mockReset()
    mocks.routerReplace.mockReset()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{}", {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("disables start button immediately when initial survey hasResponded is true", async () => {
    render(
      <SurveyClientPage
        initialSurvey={{ ...baseSurvey, hasResponded: true }}
        surveyId={baseSurvey.id}
        surveyBasePoints={1}
      />
    )

    const startButton = await screen.findByRole("button", { name: "已填過" })
    expect(startButton).toBeDisabled()
    expect(screen.getByText("你已完成這份問卷")).toBeInTheDocument()
  })
})
