import { buildCsvContent, escapeCsvCell } from "@/lib/csv"
import { describe, expect, it } from "vitest"

describe("csv helpers", () => {
  it("escapes quotes and commas", () => {
    expect(escapeCsvCell('Hello, "World"')).toBe('"Hello, ""World"""')
  })

  it("builds crlf csv with excel bom", () => {
    const content = buildCsvContent(
      [
        ["name", "city"],
        ["王小明", "台北"],
      ],
      { includeBom: true, lineBreak: "crlf" }
    )

    expect(content.startsWith("\uFEFF")).toBe(true)
    expect(content).toContain("王小明")
    expect(content.endsWith("\r\n")).toBe(true)
  })

  it("builds utf8 csv without bom", () => {
    const content = buildCsvContent(
      [
        ["id", "value"],
        ["1", "中文"],
      ],
      { includeBom: false, lineBreak: "crlf" }
    )

    expect(content.startsWith("\uFEFF")).toBe(false)
    expect(content).toContain("中文")
    expect(content.endsWith("\r\n")).toBe(true)
  })
})
