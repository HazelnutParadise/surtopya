import { describe, expect, it } from "vitest"
import { buildSubmitAnswers } from "@/lib/response-submit"
import type { SurveyDisplay } from "@/lib/survey-mappers"

describe("buildSubmitAnswers", () => {
  it("maps basic question types and drops empty answers", () => {
    const survey: SurveyDisplay = {
      id: "s1",
      title: "t",
      description: "d",
      theme: undefined,
      responseCount: 0,
      settings: {
        isPublic: true,
        isResponseOpen: true,
        visibility: "public",
        isDatasetActive: true,
        everPublic: false,
        pointsReward: 1,
        publishedCount: 0,
        currentPublishedVersionNumber: 1,
      },
      questions: [
        { id: "q1", type: "single", title: "q1", required: false, options: ["a"] },
        { id: "q2", type: "multi", title: "q2", required: false, options: ["a", "b"] },
        { id: "q3", type: "short", title: "q3", required: false },
        { id: "q4", type: "rating", title: "q4", required: false, maxRating: 5 },
        { id: "q5", type: "date", title: "q5", required: false },
        { id: "p1", type: "section", title: "page", required: false },
      ],
    }

    const answers = {
      q1: "a",
      q2: ["a", ""],
      q3: "hello",
      q4: 4,
      q5: "",
    }

    expect(buildSubmitAnswers(survey, answers)).toEqual([
      { questionId: "q1", value: { value: "a" } },
      { questionId: "q2", value: { values: ["a"] } },
      { questionId: "q3", value: { text: "hello" } },
      { questionId: "q4", value: { rating: 4 } },
    ])
  })
})
