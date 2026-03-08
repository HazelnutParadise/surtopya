import { describe, expect, it } from "vitest"
import { analyzeDraftGuestMerge, buildSubmitAnswers, resolveDraftGuestMerge } from "@/lib/response-submit"
import type { SurveyDisplay } from "@/lib/survey-mappers"

const createSurveyFixture = (): SurveyDisplay => ({
  id: "s1",
  title: "t",
  description: "d",
  theme: undefined,
  responseCount: 0,
    settings: {
      isPublic: true,
      isResponseOpen: true,
      requireLoginToRespond: false,
      visibility: "public",
      isDatasetActive: true,
    everPublic: false,
    pointsReward: 1,
    publishedCount: 0,
    currentPublishedVersionNumber: 1,
  },
  questions: [
    { id: "q1", type: "single", title: "q1", required: false, options: ["a", "b"] },
    { id: "q2", type: "multi", title: "q2", required: false, options: ["x", "y", "z"] },
    { id: "q3", type: "short", title: "q3", required: false },
    { id: "q4", type: "rating", title: "q4", required: false, maxRating: 5 },
    { id: "q5", type: "date", title: "q5", required: false },
    { id: "p1", type: "section", title: "page", required: false },
  ],
})

describe("buildSubmitAnswers", () => {
  it("maps basic question types and drops empty answers", () => {
    const survey = createSurveyFixture()

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

describe("draft/guest merge", () => {
  it("detects conflicts and treats multi answer order as equivalent", () => {
    const survey = createSurveyFixture()

    const draftAnswers = {
      q1: "a",
      q2: ["x", "y"],
      q3: "cloud",
    }
    const guestAnswers = {
      q1: "b",
      q2: ["y", "x"],
      q4: 5,
    }

    const analysis = analyzeDraftGuestMerge(survey, draftAnswers, guestAnswers)

    expect(analysis.conflictQuestionIds).toEqual(["q1"])
    expect(analysis.mergedNonConflictingAnswers).toEqual({
      q2: ["x", "y"],
      q3: "cloud",
      q4: 5,
    })
  })

  it("resolves conflicts by selected source and keeps non-conflicting union", () => {
    const survey = createSurveyFixture()

    const draftAnswers = {
      q1: "a",
      q3: "cloud",
    }
    const guestAnswers = {
      q1: "b",
      q4: 3,
    }

    expect(resolveDraftGuestMerge(survey, draftAnswers, guestAnswers, "guest")).toEqual({
      q1: "b",
      q3: "cloud",
      q4: 3,
    })

    expect(resolveDraftGuestMerge(survey, draftAnswers, guestAnswers, "draft")).toEqual({
      q1: "a",
      q3: "cloud",
      q4: 3,
    })
  })
})
