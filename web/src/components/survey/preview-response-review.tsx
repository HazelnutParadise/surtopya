"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownContent } from "@/components/ui/markdown-content"
import {
  getAnswerOtherText,
  getMultiAnswerValues,
  getSingleAnswerValue,
} from "@/lib/survey-answer-state"
import type { Question, Survey } from "@/types/survey"
import { useLocale, useTranslations } from "next-intl"

type PreviewResponseReviewProps = {
  survey: Pick<Survey, "questions" | "title">
  answers: Record<string, unknown>
  displayMode: "modal" | "full-screen"
}

type AnswerItem = {
  questionId: string
  title: string
  values: string[]
  otherText?: string
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const getTextAnswer = (raw: unknown) => {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

const formatDateAnswer = (value: string, locale: string): string => {
  const normalized = value.trim()
  if (!normalized) return normalized

  const isoDateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  let parsedDate: Date | null = null

  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch
    parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  } else {
    const candidate = new Date(normalized)
    if (!Number.isNaN(candidate.getTime())) {
      parsedDate = candidate
    }
  }

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return normalized
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(parsedDate)
  } catch {
    return normalized
  }
}

const formatAnswerItem = (
  question: Question,
  raw: unknown,
  t: ReturnType<typeof useTranslations>,
  locale: string
): AnswerItem | null => {
  switch (question.type) {
    case "single":
    case "select": {
      const value = getSingleAnswerValue(raw)
      if (!value) return null
      const otherText = getAnswerOtherText(raw).trim()
      return {
        questionId: question.id,
        title: question.title,
        values: [value],
        otherText: otherText || undefined,
      }
    }
    case "multi": {
      const values = getMultiAnswerValues(raw)
      if (values.length === 0) return null
      const otherText = getAnswerOtherText(raw).trim()
      return {
        questionId: question.id,
        title: question.title,
        values,
        otherText: otherText || undefined,
      }
    }
    case "rating": {
      if (!isFiniteNumber(raw)) return null
      return {
        questionId: question.id,
        title: question.title,
        values: [t("ratingValue", { value: raw, max: question.maxRating || 5 })],
      }
    }
    case "date": {
      const value = getTextAnswer(raw)
      if (!value) return null
      return {
        questionId: question.id,
        title: question.title,
        values: [formatDateAnswer(value, locale)],
      }
    }
    case "text":
    case "short":
    case "long": {
      const value = getTextAnswer(raw)
      if (!value) return null
      return {
        questionId: question.id,
        title: question.title,
        values: [value],
      }
    }
    default:
      return null
  }
}

export function PreviewResponseReview({
  survey,
  answers,
  displayMode,
}: PreviewResponseReviewProps) {
  const t = useTranslations("PreviewResponseReview")
  const locale = useLocale()

  const answeredItems = survey.questions
    .filter((question) => question.type !== "section")
    .map((question) => formatAnswerItem(question, answers[question.id], t, locale))
    .filter((item): item is AnswerItem => item !== null)

  return (
    <div
      className={
        displayMode === "full-screen"
          ? "mx-auto w-full max-w-5xl space-y-6 px-4 py-8"
          : "space-y-4"
      }
    >
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
          {t("title")}
        </p>
        <h2 className="text-2xl font-semibold text-gray-900">{survey.title}</h2>
      </div>

      {answeredItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-500">{t("empty")}</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {answeredItems.map((item) => (
            <Card key={item.questionId}>
              <CardHeader className="space-y-2">
                <CardTitle className="text-base text-gray-900">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {item.values.map((value) => (
                    <Badge
                      key={`${item.questionId}-${value}`}
                      variant="secondary"
                      className="max-w-full px-3 py-1.5 text-sm"
                    >
                      <MarkdownContent content={value} inline className="max-w-none" />
                    </Badge>
                  ))}
                </div>
                {item.otherText ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      {t("otherTextLabel")}
                    </p>
                    <div className="mt-1 text-sm text-gray-800">
                      <MarkdownContent content={item.otherText} className="max-w-none" />
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
