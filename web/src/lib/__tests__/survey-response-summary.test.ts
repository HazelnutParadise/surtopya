import { describe, expect, it } from "vitest"
import { getSurveyResponseSummaryQuestionCount } from "@/lib/survey-response-summary"

describe("survey response summary question count", () => {
  it("uses the selected published version question count when a specific version is active", () => {
    const count = getSurveyResponseSummaryQuestionCount({
      selectedVersion: "1",
      draftQuestions: [
        { type: "short" },
        { type: "short" },
      ],
      surveyVersions: [
        {
          versionNumber: 3,
          snapshot: {
            questions: [
              { type: "short" },
              { type: "long" },
            ],
          },
        },
        {
          versionNumber: 1,
          snapshot: {
            questions: [
              { type: "section" },
              { type: "date" },
            ],
          },
        },
      ],
    })

    expect(count).toBe(1)
  })

  it("prefers the latest published version question count over the current draft", () => {
    const count = getSurveyResponseSummaryQuestionCount({
      draftQuestions: [
        { type: "short" },
        { type: "short" },
        { type: "section" },
      ],
      surveyVersions: [
        {
          versionNumber: 3,
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
          versionNumber: 2,
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
          versionNumber: 1,
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
