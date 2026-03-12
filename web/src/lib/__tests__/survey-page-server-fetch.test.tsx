import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetchInternalApp: vi.fn(),
  mapApiSurveyToUi: vi.fn(),
  redirect: vi.fn(),
  getAuthToken: vi.fn(),
  cookies: vi.fn(),
}))

vi.mock("@/lib/internal-app-fetch", () => ({
  fetchInternalApp: mocks.fetchInternalApp,
}))

vi.mock("@/lib/survey-mappers", () => ({
  mapApiSurveyToUi: mocks.mapApiSurveyToUi,
}))

vi.mock("@/app/survey/[id]/survey-client-page", () => ({
  SurveyClientPage: () => null,
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/lib/api-server", () => ({
  getAuthToken: mocks.getAuthToken,
}))

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}))

import Page, { generateMetadata } from "@/app/survey/[id]/page"

describe("survey/[id] server page data fetch", () => {
  const surveyID = "11111111-1111-1111-1111-111111111111"

  beforeEach(() => {
    mocks.fetchInternalApp.mockReset()
    mocks.mapApiSurveyToUi.mockReset()
    mocks.redirect.mockReset()
    mocks.getAuthToken.mockReset()
    mocks.cookies.mockReset()
    mocks.getAuthToken.mockResolvedValue(null)
    mocks.cookies.mockResolvedValue({
      get: () => undefined,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns Survey Not Found metadata when survey upstream is not found", async () => {
    mocks.fetchInternalApp.mockResolvedValueOnce(new Response("{}", { status: 404 }))

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: surveyID }),
      searchParams: Promise.resolve({}),
    })

    expect(mocks.fetchInternalApp).toHaveBeenCalledWith(
      `/surveys/${surveyID}`,
      expect.objectContaining({ cache: "no-store" })
    )
    expect(metadata.title).toBe("Survey Not Found | Surtopya")
  })

  it("fetches survey and config through internal app endpoints", async () => {
    mocks.getAuthToken.mockResolvedValue("token-123")
    mocks.cookies.mockResolvedValue({
      get: () => ({ value: "anon-xyz" }),
    })

    mocks.fetchInternalApp.mockImplementation((path: string) => {
      if (path === `/surveys/${surveyID}`) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: surveyID,
              title: "Survey title",
              description: "Survey description",
              responseCount: 3,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
      }
      if (path === "/config") {
        return Promise.resolve(
          new Response(JSON.stringify({ surveyBasePoints: 5 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      }
      return Promise.resolve(new Response("{}", { status: 404 }))
    })

    mocks.mapApiSurveyToUi.mockReturnValue({
      id: surveyID,
      title: "Survey title",
      description: "Survey description",
      responseCount: 3,
      settings: { visibility: "public" },
    })

    const page = await Page({
      params: Promise.resolve({ id: surveyID }),
      searchParams: Promise.resolve({}),
    })

    expect(page).toBeTruthy()
    expect(mocks.fetchInternalApp).toHaveBeenCalledWith(
      `/surveys/${surveyID}`,
      expect.objectContaining({
        cache: "no-store",
        headers: {
          Authorization: "Bearer token-123",
          "X-Surtopya-Anonymous-Id": "anon-xyz",
        },
      })
    )
    expect(mocks.fetchInternalApp).toHaveBeenCalledWith(
      "/config",
      expect.objectContaining({ cache: "no-store" })
    )
  })
})
