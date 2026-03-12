"use client"

import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type SurveyResponsesExportEncoding = "excel" | "utf8"
export type SurveyResponsesExportScope = "all" | number

interface SurveyResponsesExportMenuProps {
  disabled: boolean
  availableVersions: number[]
  onExport: (scope: SurveyResponsesExportScope, encoding: SurveyResponsesExportEncoding) => void
  defaultOpen?: boolean
  expandVersionSubmenus?: boolean
}

const combinedLabel = (encodingLabel: string, scopeLabel: string) => `${encodingLabel} · ${scopeLabel}`

export function SurveyResponsesExportMenu({
  disabled,
  availableVersions,
  onExport,
  defaultOpen = false,
  expandVersionSubmenus = false,
}: SurveyResponsesExportMenuProps) {
  const t = useTranslations("SurveyManagement")

  const renderVersionSubmenu = (encoding: SurveyResponsesExportEncoding, encodingLabel: string) => {
    if (availableVersions.length === 0) {
      return null
    }

    return (
      <DropdownMenuSub open={expandVersionSubmenus ? true : undefined}>
        <DropdownMenuSubTrigger data-testid={`responses-export-${encoding}-submenu-trigger`}>
          {encodingLabel}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent forceMount>
          {availableVersions.map((version) => (
            <DropdownMenuItem
              key={`${encoding}-${version}`}
              onClick={() => onExport(version, encoding)}
            >
              {t("responseAnalyticsVersionSingle", { version })}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    )
  }

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          data-testid="dashboard-responses-export"
        >
          {t("exportCsv")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72" forceMount>
        <DropdownMenuItem onClick={() => onExport("all", "excel")}>
          {combinedLabel(t("exportCsvExcel"), t("responseAnalyticsVersionAll"))}
        </DropdownMenuItem>
        {renderVersionSubmenu("excel", t("exportCsvExcel"))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onExport("all", "utf8")}>
          {combinedLabel(t("exportCsvUtf8"), t("responseAnalyticsVersionAll"))}
        </DropdownMenuItem>
        {renderVersionSubmenu("utf8", t("exportCsvUtf8"))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
