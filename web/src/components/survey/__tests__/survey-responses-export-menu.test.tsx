import { fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"
import { SurveyResponsesExportMenu } from "@/components/survey/survey-responses-export-menu"

const messages = {
  SurveyManagement: {
    exportCsv: "Export CSV",
    exportCsvExcel: "Export CSV (Excel)",
    exportCsvUtf8: "Export CSV (UTF-8)",
    responseAnalyticsVersionAll: "All versions",
    responseAnalyticsVersionSingle: "Version {version}",
    viewSurvey: "View survey",
  },
}

describe("SurveyResponsesExportMenu", () => {
  it("renders version-first scope submenus and makes the version list scrollable", () => {
    const onExport = vi.fn()

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SurveyResponsesExportMenu
          disabled={false}
          availableVersions={[5, 4, 3, 2, 1]}
          onExport={onExport}
          defaultOpen
          expandVersionSubmenus
        />
      </NextIntlClientProvider>
    )

    expect(screen.getByTestId("responses-export-menu-content")).toHaveClass("max-h-96")
    expect(screen.getByTestId("responses-export-menu-content")).toHaveClass("overflow-y-auto")
    expect(screen.getByTestId("responses-export-scope-all-trigger")).toHaveTextContent("All versions")
    expect(screen.getByTestId("responses-export-scope-version-5-trigger")).toHaveTextContent("Version 5")
    expect(screen.getByTestId("responses-export-all-excel")).toHaveTextContent("Export CSV (Excel)")
    expect(screen.getByTestId("responses-export-version-5-utf8")).toHaveTextContent("Export CSV (UTF-8)")
  })

  it("emits an all-version excel export request", () => {
    const onExport = vi.fn()

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SurveyResponsesExportMenu
          disabled={false}
          availableVersions={[3, 2]}
          onExport={onExport}
          defaultOpen
          expandVersionSubmenus
        />
      </NextIntlClientProvider>
    )

    fireEvent.click(screen.getByTestId("responses-export-all-excel"))

    expect(onExport).toHaveBeenCalledWith("all", "excel")
  })

  it("emits a specific-version utf8 export request", () => {
    const onExport = vi.fn()

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SurveyResponsesExportMenu
          disabled={false}
          availableVersions={[3, 2]}
          onExport={onExport}
          defaultOpen
          expandVersionSubmenus
        />
      </NextIntlClientProvider>
    )

    fireEvent.click(screen.getByTestId("responses-export-version-3-utf8"))

    expect(onExport).toHaveBeenCalledWith(3, "utf8")
  })
})
