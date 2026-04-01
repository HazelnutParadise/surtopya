import { describe, expect, it, beforeEach } from "vitest"
import {
  clearResponseCompletionCopy,
  readResponseCompletionCopy,
  writeResponseCompletionCopy,
} from "@/lib/response-completion"

describe("response completion copy storage", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("round-trips completion copy by response id", () => {
    writeResponseCompletionCopy("response-1", {
      title: "Thanks",
      message: "Custom message",
    })

    expect(readResponseCompletionCopy("response-1")).toEqual({
      title: "Thanks",
      message: "Custom message",
    })
  })

  it("clears stored completion copy", () => {
    writeResponseCompletionCopy("response-1", {
      title: "Thanks",
      message: "Custom message",
    })

    clearResponseCompletionCopy("response-1")

    expect(readResponseCompletionCopy("response-1")).toBeNull()
  })
})
