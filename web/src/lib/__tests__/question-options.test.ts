import { describe, expect, it } from "vitest"
import { createDefaultQuestionOptions } from "@/lib/question-options"

describe("createDefaultQuestionOptions", () => {
  it("supports deterministic ids for builder drag placeholders", () => {
    const options = createDefaultQuestionOptions(
      ["Option 1", "Option 2"],
      (index, label) => `placeholder-${index + 1}-${label.toLowerCase().replace(/\s+/g, "-")}`
    )

    expect(options).toEqual([
      { id: "placeholder-1-option-1", label: "Option 1" },
      { id: "placeholder-2-option-2", label: "Option 2" },
    ])
  })
})
