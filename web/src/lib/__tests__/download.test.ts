import { describe, expect, it } from "vitest"

import {
  filenameFromContentDisposition,
  sanitizeFilename,
} from "@/lib/download"

describe("download helpers", () => {
  it("parses quoted filename", () => {
    const name = filenameFromContentDisposition(
      'attachment; filename="report.csv"'
    )
    expect(name).toBe("report.csv")
  })

  it("parses unquoted filename", () => {
    const name = filenameFromContentDisposition("attachment; filename=report.csv")
    expect(name).toBe("report.csv")
  })

  it("parses RFC5987 filename* (utf-8, percent-encoded)", () => {
    const name = filenameFromContentDisposition(
      "attachment; filename*=UTF-8''%E4%B8%AD%E6%96%87.csv"
    )
    expect(name).toBe("中文.csv")
  })

  it("sanitizes path traversal attempts", () => {
    expect(sanitizeFilename("../../evil.txt")).toBe("evil.txt")
    expect(sanitizeFilename("..\\..\\evil.txt")).toBe("evil.txt")
  })
})

