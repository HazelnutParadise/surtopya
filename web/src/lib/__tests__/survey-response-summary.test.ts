import { describe, expect, it } from "vitest"
import { getSurveyResponseSummaryQuestionCount } from "@/lib/survey-response-summary"

describe("survey response summary question count", () => {
  it("prefers the latest published version question count over the current draft", () => {
    const count = getSurveyResponseSummaryQuestionCount({
      draftQuestions: [
        { type: "short" },
        { type: "short" },
        { type: "section" },
      ],
      surveyVersions: [
        {
          snapshot: {
            questions: [
              { type: "short" },
              { type: "section" },
              { type: "long" },
              { type: "date" },
            ],
          },
        },
        {
          snapshot: {
            questions: [{ type: "short" }],
          },
        },
      ],
    })

    expect(count).toBe(3)
  })

  it("falls back to the current draft question count when no published versions exist", () => {
    const count = getSurveyResponseSummaryQuestionCount({
      draftQuestions: [
        { type: "section" },
        { type: "short" },
        { type: "multi" },
      ],
      surveyVersions: [],
    })

    expect(count).toBe(2)
  })

  it("returns zero when the latest published version contains only section breaks", () => {
    const count = getSurveyResponseSummaryQuestionCount({
      draftQuestions: [{ type: "short" }],
      surveyVersions: [
        {
          snapshot: {
            questions: [
              { type: "section" },
              { type: "section" },
            ],
          },
        },
      ],
    })

    expect(count).toBe(0)
  })
})
