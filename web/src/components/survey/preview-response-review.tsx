"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getAnswerOtherText,
  getMultiAnswerValues,
  getSingleAnswerValue,
} from "@/lib/survey-answer-state"
import { cn } from "@/lib/utils"
import type { Question, Survey } from "@/types/survey"
import { CalendarDays, CheckCircle2, CircleDot, Star } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

type PreviewResponseReviewProps = {
  survey: Pick<Survey, "questions" | "title">
  answers: Record<string, unknown>
  displayMode: "modal" | "full-screen"
}

type BaseAnswerItem = {
  questionId: string
  title: string
}

type SingleAnswerItem = BaseAnswerItem & {
  kind: "single" | "select"
  value: string
  otherText?: string
}

type MultiAnswerItem = BaseAnswerItem & {
  kind: "multi"
  values: string[]
  otherText?: string
}

type RatingAnswerItem = BaseAnswerItem & {
  kind: "rating"
  value: number
  max: number
  label: string
}

type DateAnswerItem = BaseAnswerItem & {
  kind: "date"
  value: string
}

type TextAnswerItem = BaseAnswerItem & {
  kind: "text" | "short" | "long"
  value: string
}

type AnswerItem =
  | SingleAnswerItem
  | MultiAnswerItem
  | RatingAnswerItem
  | DateAnswerItem
  | TextAnswerItem

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
        kind: question.type,
        questionId: question.id,
        title: question.title,
        value,
        otherText: otherText || undefined,
      }
    }
    case "multi": {
      const values = getMultiAnswerValues(raw)
      if (values.length === 0) return null
      const otherText = getAnswerOtherText(raw).trim()
      return {
        kind: "multi",
        questionId: question.id,
        title: question.title,
        values,
        otherText: otherText || undefined,
      }
    }
    case "rating": {
      if (!isFiniteNumber(raw)) return null
      const max = question.maxRating || 5
      return {
        kind: "rating",
        questionId: question.id,
        title: question.title,
        value: raw,
        max,
        label: t("ratingValue", { value: raw, max }),
      }
    }
    case "date": {
      const value = getTextAnswer(raw)
      if (!value) return null
      return {
        kind: "date",
        questionId: question.id,
        title: question.title,
        value: formatDateAnswer(value, locale),
      }
    }
    case "text":
    case "short":
    case "long": {
      const value = getTextAnswer(raw)
      if (!value) return null
      return {
        kind: question.type,
        questionId: question.id,
        title: question.title,
        value,
      }
    }
    default:
      return null
  }
}

function PreservedText({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return <div className={cn("whitespace-pre-wrap break-words", className)}>{content}</div>
}

function SupplementalText({ content, label }: { content: string; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <PreservedText content={content} className="mt-2 text-sm leading-6 text-slate-800" />
    </div>
  )
}

function renderAnswerBody(item: AnswerItem, otherTextLabel: string) {
  switch (item.kind) {
    case "single":
    case "select":
      return (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-white p-2 text-slate-500 shadow-sm">
                <CircleDot className="h-4 w-4" />
              </div>
              <PreservedText content={item.value} className="min-w-0 flex-1 text-base font-medium text-slate-900" />
            </div>
          </div>
          {item.otherText ? <SupplementalText content={item.otherText} label={otherTextLabel} /> : null}
        </div>
      )
    case "multi":
      return (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
            <ul className="space-y-2">
              {item.values.map((value) => (
                <li key={`${item.questionId}-${value}`} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <PreservedText content={value} className="min-w-0 flex-1 text-base text-slate-900" />
                </li>
              ))}
            </ul>
          </div>
          {item.otherText ? <SupplementalText content={item.otherText} label={otherTextLabel} /> : null}
        </div>
      )
    case "rating":
      return (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1" aria-label={item.label}>
              {Array.from({ length: item.max }, (_, index) => (
                <Star
                  key={`${item.questionId}-star-${index + 1}`}
                  className={cn(
                    "h-5 w-5",
                    index < item.value ? "fill-amber-400 text-amber-400" : "text-slate-300"
                  )}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-slate-700">{item.label}</span>
          </div>
        </div>
      )
    case "date":
      return (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-4">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <PreservedText content={item.value} className="min-w-0 flex-1 text-base font-medium text-slate-900" />
          </div>
        </div>
      )
    case "text":
    case "short":
    case "long":
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <PreservedText content={item.value} className="text-base leading-7 text-slate-900" />
        </div>
      )
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
              <CardContent>{renderAnswerBody(item, t("otherTextLabel"))}</CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
