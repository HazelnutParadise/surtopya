import fs from "fs"
import path from "path"
import { describe, expect, it } from "vitest"

const readMessage = (locale: string) => {
  const filePath = path.join(process.cwd(), "messages", `${locale}.json`)
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    SurveyPage?: { privacyDescription?: string }
  }
  return payload.SurveyPage?.privacyDescription ?? ""
}

describe("SurveyPage privacyDescription copy", () => {
  it("does not use absolute no-save wording that conflicts with progress notices", () => {
    const zhTW = readMessage("zh-TW")
    const en = readMessage("en")
    const ja = readMessage("ja")

    expect(zhTW).not.toContain("不會儲存進度")
    expect(en).not.toContain("without saving your progress")
    expect(ja).not.toContain("保存せず")
  })
})
