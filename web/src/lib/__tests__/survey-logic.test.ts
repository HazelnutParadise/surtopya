import { describe, expect, it } from "vitest"
import type { Question } from "@/types/survey"
import { getQuestionLogicIssues, normalizeQuestionLogic } from "@/lib/survey-logic"

describe("survey logic helpers", () => {
  it("normalizes legacy label-bound logic rules to option-id conditions", () => {
    const question: Question = {
      id: "q1",
      type: "multi",
      title: "Choose",
      required: false,
      options: [
        { id: "opt-a", label: "A" },
        { id: "opt-b", label: "B" },
      ],
      logic: [{ triggerOption: "B", destinationQuestionId: "page-2" }],
    }

    const normalized = normalizeQuestionLogic(question)

    expect(normalized.logic).toEqual([
      {
        triggerOption: "B",
        operator: "or",
        conditions: [{ optionId: "opt-b", match: "includes" }],
        destinationQuestionId: "page-2",
      },
    ])
  })

  it("keeps logic valid after option rename because rules bind by option id", () => {
    const question: Question = {
      id: "q1",
      type: "multi",
      title: "Choose",
      required: false,
      options: [{ id: "opt-a", label: "Renamed option" }],
      logic: [
        {
          operator: "or",
          conditions: [{ optionId: "opt-a", match: "includes" }],
          destinationQuestionId: "page-2",
        },
      ],
    }

    const issues = getQuestionLogicIssues(question, [
      { id: "page-1", type: "section", title: "Page 1", required: false },
      question,
      { id: "page-2", type: "section", title: "Page 2", required: false },
    ])

    expect(issues).toEqual([])
  })

  it("flags contradictory conditions and missing option references as blocking issues", () => {
    const question: Question = {
      id: "q1",
      type: "multi",
      title: "Choose",
      required: false,
      options: [{ id: "opt-a", label: "A" }],
      logic: [
        {
          operator: "and",
          conditions: [
            { optionId: "opt-a", match: "includes" },
            { optionId: "opt-a", match: "excludes" },
            { optionId: "opt-missing", match: "includes" },
          ],
          destinationQuestionId: "page-2",
        },
      ],
    }

    const issues = getQuestionLogicIssues(question, [
      { id: "page-1", type: "section", title: "Page 1", required: false },
      question,
      { id: "page-2", type: "section", title: "Page 2", required: false },
    ])

    expect(issues.map((issue) => issue.code)).toEqual([
      "contradictory_conditions",
      "deleted_option",
    ])
  })
})
