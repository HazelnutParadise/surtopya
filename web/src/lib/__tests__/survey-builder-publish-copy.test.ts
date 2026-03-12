import en from "../../../messages/en.json"
import ja from "../../../messages/ja.json"
import zhTW from "../../../messages/zh-TW.json"
import { describe, expect, it } from "vitest"

describe("survey builder publish copy", () => {
  it("uses publish new version wording instead of republish across locales", () => {
    expect(en.SurveyBuilder.republish).toBe("Publish new version")
    expect(en.SurveyBuilder.confirmRepublish).toBe("Confirm & Publish new version")
    expect(en.SurveyManagement.publishNewVersion).toBe("Publish new version")

    expect(zhTW.SurveyBuilder.republish).toBe("發布新版本")
    expect(zhTW.SurveyBuilder.confirmRepublish).toBe("確認並發布新版本")
    expect(zhTW.SurveyManagement.publishNewVersion).toBe("發布新版本")

    expect(ja.SurveyBuilder.republish).toBe("新バージョンを公開")
    expect(ja.SurveyBuilder.confirmRepublish).toBe("確認して新バージョンを公開")
    expect(ja.SurveyManagement.publishNewVersion).toBe("新バージョンを公開")
  })
})
