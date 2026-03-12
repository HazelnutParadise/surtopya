"use client"

import type { LucideIcon } from "lucide-react"
import { Calendar, MessageSquare, Users } from "lucide-react"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"

interface SurveyResponseSummaryCardsProps {
  totalResponses: number
  questionCount: number
  lastResponseDate?: string
  lastResponseTime?: string
}

interface SummaryCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  iconClassName: string
  valueTestId: string
  secondaryValue?: string
  secondaryValueTestId?: string
  valueClassName?: string
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  iconClassName,
  valueTestId,
  secondaryValue,
  secondaryValueTestId,
  valueClassName,
}: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4">
        <div className={`rounded-xl p-3 ${iconClassName}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-500">{label}</p>
          <p
            data-testid={valueTestId}
            className={`break-words font-bold leading-tight text-gray-900 dark:text-white ${valueClassName || "text-2xl"}`}
          >
            {value}
          </p>
          {secondaryValue ? (
            <p
              data-testid={secondaryValueTestId}
              className="mt-1 break-words text-xl font-bold leading-tight text-gray-900 dark:text-white"
            >
              {secondaryValue}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function SurveyResponseSummaryCards({
  totalResponses,
  questionCount,
  lastResponseDate,
  lastResponseTime,
}: SurveyResponseSummaryCardsProps) {
  const t = useTranslations("SurveyManagement")

  return (
    <div
      data-testid="survey-response-summary-grid"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      <SummaryCard
        label={t("totalResponses")}
        value={totalResponses}
        icon={Users}
        iconClassName="bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400"
        valueTestId="summary-total-responses"
      />
      <SummaryCard
        label={t("lastResponse")}
        value={lastResponseDate || "--"}
        secondaryValue={lastResponseDate ? lastResponseTime : undefined}
        secondaryValueTestId="summary-last-response-time"
        icon={Calendar}
        iconClassName="bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400"
        valueTestId="summary-last-response-date"
        valueClassName="text-xl md:text-2xl"
      />
      <SummaryCard
        label={t("questions")}
        value={questionCount}
        icon={MessageSquare}
        iconClassName="bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"
        valueTestId="summary-question-count"
      />
    </div>
  )
}
