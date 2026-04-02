import { describe, expect, it, vi } from "vitest"
import { buildPreviewSurvey, openSurveyPreview } from "@/lib/survey-preview"

describe("survey preview helpers", () => {
  it("builds a normalized preview survey from partial editor state", () => {
    const survey = buildPreviewSurvey({
      id: "preview",
      title: "Draft title",
      description: "Draft description",
      completionTitle: "Draft thanks",
      completionMessage: "Draft message",
      questions: [],
      settings: {
        isPublic: true,
        pointsReward: 25,
      },
    })

    expect(survey).toMatchObject({
      id: "preview",
      title: "Draft title",
      description: "Draft description",
      completionTitle: "Draft thanks",
      completionMessage: "Draft message",
      questions: [],
      settings: {
        isPublic: true,
        isResponseOpen: true,
        requireLoginToRespond: false,
        visibility: "public",
        isDatasetActive: false,
        pointsReward: 25,
      },
    })
  })

  it("stores preview data and opens the shared preview page", () => {
    const setItem = vi.fn()
    const openWindow = vi.fn()

    openSurveyPreview({
      survey: {
        id: "survey-1",
        title: "Published title",
        description: "Published description",
        completionTitle: "Published thanks",
        completionMessage: "Published message",
        questions: [],
        settings: {
          isPublic: false,
          isResponseOpen: false,
          requireLoginToRespond: true,
          visibility: "non-public",
          isDatasetActive: true,
          pointsReward: 10,
        },
      },
      theme: {
        primaryColor: "#111111",
        backgroundColor: "#ffffff",
        fontFamily: "inter",
      },
      previewPath: "/zh-TW/create/preview",
      storage: { setItem },
      openWindow,
    })

    expect(setItem).toHaveBeenCalledTimes(2)

    const surveyPayload = JSON.parse(setItem.mock.calls[0][1] as string)
    expect(setItem.mock.calls[0][0]).toBe("preview_survey")
    expect(surveyPayload.completionTitle).toBe("Published thanks")
    expect(surveyPayload.completionMessage).toBe("Published message")

    expect(setItem.mock.calls[1][0]).toBe("preview_theme")
    expect(JSON.parse(setItem.mock.calls[1][1] as string)).toEqual({
      primaryColor: "#111111",
      backgroundColor: "#ffffff",
      fontFamily: "inter",
    })

    expect(openWindow).toHaveBeenCalledWith("/zh-TW/create/preview", "_blank")
  })
})
