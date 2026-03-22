"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export type SurveyResponsesExportEncoding = "excel" | "utf8"
export type SurveyResponsesExportScope = "all" | number

interface SurveyResponsesExportDialogProps {
  disabled: boolean
  availableVersions: number[]
  onExport: (scope: SurveyResponsesExportScope, encoding: SurveyResponsesExportEncoding) => void
}

const parseScopeValue = (value: string): SurveyResponsesExportScope => {
  if (value === "all") return "all"
  const version = Number(value)
  return Number.isFinite(version) ? version : "all"
}

export function SurveyResponsesExportDialog({
  disabled,
  availableVersions,
  onExport,
}: SurveyResponsesExportDialogProps) {
  const t = useTranslations("SurveyManagement")
  const tCommon = useTranslations("Common")
  const [open, setOpen] = useState(false)
  const [selectedScope, setSelectedScope] = useState<SurveyResponsesExportScope>("all")

  const handleExport = (encoding: SurveyResponsesExportEncoding) => {
    onExport(selectedScope, encoding)
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="outline"
        disabled={disabled}
        data-testid="dashboard-responses-export"
        onClick={() => {
          setSelectedScope("all")
          setOpen(true)
        }}
      >
        {t("exportCsv")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("exportCsv")}</DialogTitle>
            <DialogDescription>{t("exportCsvHint")}</DialogDescription>
          </DialogHeader>

          <div
            data-testid="responses-export-scope-list"
            className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 p-1 dark:border-gray-800"
          >
            <RadioGroup
              value={String(selectedScope)}
              onValueChange={(value) => setSelectedScope(parseScopeValue(value))}
            >
              <label
                htmlFor="responses-export-scope-all"
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-sm transition hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <RadioGroupItem value="all" id="responses-export-scope-all" />
                <span>{t("responseAnalyticsVersionAll")}</span>
              </label>

              {availableVersions.map((version) => (
                <label
                  key={version}
                  htmlFor={`responses-export-scope-${version}`}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-sm transition hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <RadioGroupItem
                    value={String(version)}
                    id={`responses-export-scope-${version}`}
                  />
                  <span>{t("responseAnalyticsVersionSingle", { version })}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => handleExport("utf8")}>
                {t("exportCsvUtf8")}
              </Button>
              <Button onClick={() => handleExport("excel")}>
                {t("exportCsvExcel")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
