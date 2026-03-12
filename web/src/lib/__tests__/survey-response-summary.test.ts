import { describe, expect, it } from "vitest"
import { getSurveyResponseSummaryQuestionCount } from "@/lib/survey-response-summary"

describe("survey response summary question count", () => {
  it("prefers the latest published version question count over the current draft", () => {
    const count = getSurveyResponseSummaryQuestionCount({
      draftQuestions: [
        { id: "draft-q1", type: "short" },
        { id: "draft-q2", type: "short" },
        { id: "draft-section", type: "section" },
      ],
      surveyVersions: [
        {
          versionNumber: 3,
          snapshot: {
            questions: [
              { id: "v3-q1", type: "short" },
              { id: "v3-section", type: "section" },
              { id: "v3-q2", type: "long" },
              { id: "v3-q3", type: "date" },
            ],
          },
        },
        {
          versionNumber: 2,
          snapshot: {
            questions: [{ id: "v2-q1", type: "short" }],
          },
        },
      ],
    })

    expect(count).toBe(3)
  })

  it("falls back to the current draft question count when no published versions exist", () => {
    const count = getSurveyResponseSummaryQuestionCount({
      draftQuestions: [
        { id: "draft-section", type: "section" },
        { id: "draft-q1", type: "short" },
        { id: "draft-q2", type: "multi" },
      ],
      surveyVersions: [],
    })

    expect(count).toBe(2)
  })

  it("returns zero when the latest published version contains only section breaks", () => {
    const count = getSurveyResponseSummaryQuestionCount({
      draftQuestions: [{ id: "draft-q1", type: "short" }],
      surveyVersions: [
        {
          versionNumber: 5,
          snapshot: {
            questions: [
              { id: "v5-section-1", type: "section" },
              { id: "v5-section-2", type: "section" },
            ],
          },
        },
      ],
    })

    expect(count).toBe(0)
  })
})
