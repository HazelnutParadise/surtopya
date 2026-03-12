import { fireEvent, render, screen, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"
import { SurveyResponsesExportDialog } from "@/components/survey/survey-responses-export-menu"

const messages = {
  SurveyManagement: {
    exportCsv: "Export CSV",
    exportCsvExcel: "Export CSV (Excel)",
    exportCsvUtf8: "Export CSV (UTF-8)",
    exportCsvHint: "Exports completed responses only and includes per-question answer columns.",
    responseAnalyticsVersionAll: "All versions",
    responseAnalyticsVersionSingle: "Version {version}",
  },
  Common: {
    cancel: "Cancel",
  },
}

describe("SurveyResponsesExportDialog", () => {
  it("renders a modal export flow with a scrollable version list", () => {
    const onExport = vi.fn()

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SurveyResponsesExportDialog
          disabled={false}
          availableVersions={[5, 4, 3, 2, 1]}
          onExport={onExport}
        />
      </NextIntlClientProvider>
    )

    fireEvent.click(screen.getByTestId("dashboard-responses-export"))

    const dialog = screen.getByRole("dialog")

    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText("Export CSV")).toBeInTheDocument()
    expect(within(dialog).getByText(messages.SurveyManagement.exportCsvHint)).toBeInTheDocument()
    expect(screen.getByTestId("responses-export-scope-list")).toHaveClass("overflow-y-auto")
    expect(screen.getByTestId("responses-export-scope-list")).toHaveClass("max-h-64")
    expect(screen.getByRole("radio", { name: "All versions" })).toHaveAttribute("data-state", "checked")
    expect(screen.getByRole("radio", { name: "Version 5" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Export CSV (Excel)" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Export CSV (UTF-8)" })).toBeInTheDocument()
  })

  it("exports all versions as excel and closes the dialog", () => {
    const onExport = vi.fn()

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SurveyResponsesExportDialog
          disabled={false}
          availableVersions={[3, 2]}
          onExport={onExport}
        />
      </NextIntlClientProvider>
    )

    fireEvent.click(screen.getByTestId("dashboard-responses-export"))
    fireEvent.click(screen.getByRole("button", { name: "Export CSV (Excel)" }))

    expect(onExport).toHaveBeenCalledWith("all", "excel")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("exports a specific version as utf8 and closes the dialog", () => {
    const onExport = vi.fn()

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SurveyResponsesExportDialog
          disabled={false}
          availableVersions={[3, 2]}
          onExport={onExport}
        />
      </NextIntlClientProvider>
    )

    fireEvent.click(screen.getByTestId("dashboard-responses-export"))
    fireEvent.click(screen.getByText("Version 3"))
    fireEvent.click(screen.getByRole("button", { name: "Export CSV (UTF-8)" }))

    expect(onExport).toHaveBeenCalledWith(3, "utf8")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
