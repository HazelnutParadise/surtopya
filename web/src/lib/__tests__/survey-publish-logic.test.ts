import { describe, expect, it } from "vitest"
import type { Question } from "@/types/survey"
import { getPublishBlockingLogicEntries } from "@/lib/survey-publish-logic"

describe("getPublishBlockingLogicEntries", () => {
  it("returns non-section questions with invalid logic issues", () => {
    const questions: Question[] = [
      {
        id: "page-1",
        type: "section",
        title: "Page 1",
        required: false,
      },
      {
        id: "q-1",
        type: "single",
        title: "Question 1",
        required: false,
        options: [{ id: "opt-1", label: "Option 1" }],
        logic: [
          {
            operator: "or",
            conditions: [{ optionId: "opt-1", match: "includes" }],
            destinationQuestionId: "missing-question",
          },
        ],
      },
    ]

    expect(getPublishBlockingLogicEntries(questions)).toEqual([
      {
        question: expect.objectContaining({ id: "q-1", title: "Question 1" }),
        issues: [{ code: "deleted_destination", ruleIndex: 0 }],
      },
    ])
  })

  it("ignores section rows even when they have no logic payload", () => {
    const questions: Question[] = [
      {
        id: "page-1",
        type: "section",
        title: "Page 1",
        required: false,
      },
    ]

    expect(getPublishBlockingLogicEntries(questions)).toEqual([])
  })
})
