import { describe, expect, it } from "vitest"
import { mapApiSurveyToUi } from "@/lib/survey-mappers"
import type { Survey } from "@/lib/api"

describe("mapApiSurveyToUi", () => {
  it("maps requireLoginToRespond into survey settings", () => {
    const survey: Survey = {
      id: "s1",
      title: "Survey",
      description: "Desc",
      completionTitle: "Thanks",
      completionMessage: "See you soon",
      visibility: "public",
      requireLoginToRespond: true,
      isResponseOpen: true,
      includeInDatasets: true,
      publishedCount: 0,
      hasUnpublishedChanges: false,
      pointsReward: 3,
      responseCount: 0,
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      questions: [],
    }

    const mapped = mapApiSurveyToUi(survey)

    expect(mapped.settings.requireLoginToRespond).toBe(true)
    expect(mapped.completionTitle).toBe("Thanks")
    expect(mapped.completionMessage).toBe("See you soon")
  })
})
