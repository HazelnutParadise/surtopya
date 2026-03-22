import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const layoutPath = resolve(process.cwd(), "src/app/layout.tsx")
const layoutSource = readFileSync(layoutPath, "utf-8")

describe("root layout metadata", () => {
  it("uses the updated site title and description", () => {
    expect(layoutSource).toContain('const SITE_TITLE = "Surtopya | Publish Surveys That Keep Growing"')
    expect(layoutSource).toContain(
      'const SITE_DESCRIPTION =\n  "Turn every survey into a searchable page, collect responses over time, and contribute de-identified data to a research community marketplace."'
    )
  })

  it("keeps openGraph and twitter metadata aligned with site title/description", () => {
    expect(layoutSource).toMatch(/openGraph:\s*\{\s*title:\s*SITE_TITLE,\s*description:\s*SITE_DESCRIPTION,\s*\}/s)
    expect(layoutSource).toMatch(
      /twitter:\s*\{\s*card:\s*"summary",\s*title:\s*SITE_TITLE,\s*description:\s*SITE_DESCRIPTION,\s*\}/s
    )
  })
})
