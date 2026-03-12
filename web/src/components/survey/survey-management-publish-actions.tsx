"use client"

import { Lock, Send, Unlock } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

interface SurveyManagementPublishActionsProps {
  hasPublishedVersion: boolean
  hasUnpublishedChanges: boolean
  isResponseOpen: boolean
  publishing: boolean
  isDirty: boolean
  onInitialPublish: () => void
  onPublishNewVersion: () => void
  onToggleResponses: () => void
}

export function SurveyManagementPublishActions({
  hasPublishedVersion,
  hasUnpublishedChanges,
  isResponseOpen,
  publishing,
  isDirty,
  onInitialPublish,
  onPublishNewVersion,
  onToggleResponses,
}: SurveyManagementPublishActionsProps) {
  const t = useTranslations("SurveyManagement")
  const tCommon = useTranslations("Common")

  const publishDisabled = publishing || isDirty

  if (!hasPublishedVersion) {
    return (
      <Button
        className="bg-emerald-600 text-white hover:bg-emerald-700"
        onClick={onInitialPublish}
        disabled={publishDisabled}
        data-testid="survey-management-initial-publish"
      >
        <Send className="mr-2 h-4 w-4" />
        {tCommon("publish")}
      </Button>
    )
  }

  return (
    <>
      {hasUnpublishedChanges ? (
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={onPublishNewVersion}
          disabled={publishDisabled}
          data-testid="survey-management-publish-new-version"
        >
          <Send className="mr-2 h-4 w-4" />
          {t("publishNewVersion")}
        </Button>
      ) : null}
      <Button
        variant="outline"
        className={
          isResponseOpen
            ? "border-amber-200 text-amber-600 hover:bg-amber-50"
            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        }
        onClick={onToggleResponses}
        disabled={publishing}
        data-testid="survey-management-toggle-responses"
      >
        {isResponseOpen ? (
          <Lock className="mr-2 h-4 w-4" />
        ) : (
          <Unlock className="mr-2 h-4 w-4" />
        )}
        {isResponseOpen ? tCommon("closeResponses") : tCommon("openResponses")}
      </Button>
    </>
  )
}
