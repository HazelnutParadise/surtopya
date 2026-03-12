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

const scopeKey = (scope: SurveyResponsesExportScope) => (scope === "all" ? "all" : `version-${scope}`)

export function SurveyResponsesExportMenu({
  disabled,
  availableVersions,
  onExport,
  defaultOpen = false,
  expandVersionSubmenus = false,
}: SurveyResponsesExportMenuProps) {
  const t = useTranslations("SurveyManagement")

  const renderScopeSubmenu = (scope: SurveyResponsesExportScope, label: string) => {
    const key = scopeKey(scope)

    return (
      <DropdownMenuSub key={key} open={expandVersionSubmenus ? true : undefined}>
        <DropdownMenuSubTrigger data-testid={`responses-export-scope-${key}-trigger`}>
          {label}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent forceMount>
          <DropdownMenuItem
            data-testid={`responses-export-${key}-excel`}
            onClick={() => onExport(scope, "excel")}
          >
            {t("exportCsvExcel")}
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid={`responses-export-${key}-utf8`}
            onClick={() => onExport(scope, "utf8")}
          >
            {t("exportCsvUtf8")}
          </DropdownMenuItem>
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
      <DropdownMenuContent
        align="end"
        className="w-72 max-h-96 overflow-y-auto"
        data-testid="responses-export-menu-content"
        forceMount
      >
        {renderScopeSubmenu("all", t("responseAnalyticsVersionAll"))}
        {availableVersions.length > 0 ? <DropdownMenuSeparator /> : null}
        {availableVersions.map((version) =>
          renderScopeSubmenu(version, t("responseAnalyticsVersionSingle", { version }))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
