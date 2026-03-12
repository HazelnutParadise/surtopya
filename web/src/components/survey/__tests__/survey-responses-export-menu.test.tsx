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
  it("renders all-version actions and version submenus for both encodings", () => {
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

    expect(screen.getByText("Export CSV (Excel) · All versions")).toBeInTheDocument()
    expect(screen.getByText("Export CSV (UTF-8) · All versions")).toBeInTheDocument()
    expect(screen.getByTestId("responses-export-excel-submenu-trigger")).toBeInTheDocument()
    expect(screen.getByTestId("responses-export-utf8-submenu-trigger")).toBeInTheDocument()
  })

  it("emits an all-version export request", () => {
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

    fireEvent.click(screen.getByText("Export CSV (Excel) · All versions"))

    expect(onExport).toHaveBeenCalledWith("all", "excel")
  })

  it("emits a specific-version export request", () => {
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

    fireEvent.click(screen.getAllByText("Version 3")[0])

    expect(onExport).toHaveBeenCalledWith(3, "excel")
  })
})
