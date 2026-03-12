"use client"

import { useMemo } from "react"
import { useLocale, useTimeZone, useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { Star } from "lucide-react"
import type { SurveyVersion } from "@/lib/api"
import { formatUtcDateTime } from "@/lib/date-time"

type SnapshotQuestion = {
  id: string
  type: string
  title: string
  description?: string | null
  options?: string[]
  required?: boolean
  maxRating?: number
  logic?: unknown[]
  sortOrder?: number
}

export type SurveyVersionSnapshotPreview = {
  title: string
  description: string
  visibility: "public" | "non-public"
  includeInDatasets: boolean
  pointsReward: number
  expiresAt?: string
  questions: SnapshotQuestion[]
}

type DiffKind = "changed" | "added" | "removed"

type QuestionDiff = {
  id: string
  kind: DiffKind
  versionQuestion?: SnapshotQuestion
  draftQuestion?: SnapshotQuestion
}

type SnapshotPage = {
  id: string
  sourceQuestionId?: string
  title: string
  description?: string | null
  questions: SnapshotQuestion[]
}

const normalizeQuestionForCompare = (question?: SnapshotQuestion) => {
  if (!question) return ""
  return JSON.stringify({
    id: question.id,
    type: question.type,
    title: question.title,
    description: question.description || "",
    options: question.options || [],
    required: Boolean(question.required),
    maxRating: question.maxRating || 0,
    logic: question.logic || [],
    sortOrder: question.sortOrder ?? 0,
  })
}

const statusClasses: Record<DiffKind, string> = {
  changed: "bg-amber-50 text-amber-700 border-amber-200",
  added: "bg-emerald-50 text-emerald-700 border-emerald-200",
  removed: "bg-rose-50 text-rose-700 border-rose-200",
}

const sortQuestions = (questions: SnapshotQuestion[]) => {
  return [...questions].sort((a, b) => {
    const left = a.sortOrder ?? Number.MAX_SAFE_INTEGER
    const right = b.sortOrder ?? Number.MAX_SAFE_INTEGER
    if (left !== right) return left - right
    return a.id.localeCompare(b.id)
  })
}

const mapQuestionTypeKey = (type: string) => {
  switch (type) {
    case "single":
      return "single"
    case "multi":
      return "multi"
    case "text":
      return "text"
    case "short":
      return "short"
    case "long":
      return "long"
    case "rating":
      return "rating"
    case "date":
      return "date"
    case "select":
      return "select"
    case "section":
      return "section"
    default:
      return null
  }
}

const buildSnapshotPages = (questions: SnapshotQuestion[], defaultPageTitle: string) => {
  const orderedQuestions = sortQuestions(questions)
  const pages: SnapshotPage[] = []
  let currentPage: SnapshotPage | null = null

  orderedQuestions.forEach((question, index) => {
    if (question.type === "section") {
      if (currentPage) pages.push(currentPage)
      currentPage = {
        id: question.id,
        sourceQuestionId: question.id,
        title: question.title || `${defaultPageTitle} ${pages.length + 1}`,
        description: question.description,
        questions: [],
      }
      return
    }

    if (!currentPage) {
      currentPage = {
        id: `implicit-page-${index}`,
        title: `${defaultPageTitle} 1`,
        questions: [],
      }
    }

    currentPage.questions.push(question)
  })

  if (currentPage) pages.push(currentPage)

  return pages
}

interface VersionDocumentPreviewProps {
  version: SurveyVersion | null
  draftSnapshot?: SurveyVersionSnapshotPreview | null
  className?: string
}

export function VersionDocumentPreview({
  version,
  draftSnapshot,
  className,
}: VersionDocumentPreviewProps) {
  const tBuilder = useTranslations("SurveyBuilder")
  const tCommon = useTranslations("Common")
  const tQuestion = useTranslations("QuestionTypes")
  const locale = useLocale()
  const timeZone = useTimeZone()

  const versionSnapshot = version?.snapshot

  const hasFieldChanged = (field: keyof SurveyVersionSnapshotPreview) => {
    if (!versionSnapshot || !draftSnapshot) return false
    if (field === "expiresAt") {
      return (versionSnapshot.expiresAt || "") !== (draftSnapshot.expiresAt || "")
    }
    return JSON.stringify(versionSnapshot[field]) !== JSON.stringify(draftSnapshot[field])
  }

  const questionDiffs = useMemo<QuestionDiff[]>(() => {
    if (!versionSnapshot) return []
    if (!draftSnapshot) {
      return versionSnapshot.questions.map((question) => ({
        id: question.id,
        kind: "changed",
        versionQuestion: question,
      }))
    }

    const versionByID = new Map(versionSnapshot.questions.map((question) => [question.id, question]))
    const draftByID = new Map(draftSnapshot.questions.map((question) => [question.id, question]))
    const allIDs = new Set([...versionByID.keys(), ...draftByID.keys()])

    const diffs: QuestionDiff[] = []
    allIDs.forEach((id) => {
      const versionQuestion = versionByID.get(id)
      const draftQuestion = draftByID.get(id)

      if (versionQuestion && !draftQuestion) {
        diffs.push({ id, kind: "removed", versionQuestion })
        return
      }
      if (!versionQuestion && draftQuestion) {
        diffs.push({ id, kind: "added", draftQuestion })
        return
      }
      if (
        versionQuestion &&
        draftQuestion &&
        normalizeQuestionForCompare(versionQuestion) !== normalizeQuestionForCompare(draftQuestion)
      ) {
        diffs.push({ id, kind: "changed", versionQuestion, draftQuestion })
      }
    })

    return diffs.sort((a, b) => {
      const left = a.versionQuestion?.sortOrder ?? a.draftQuestion?.sortOrder ?? 0
      const right = b.versionQuestion?.sortOrder ?? b.draftQuestion?.sortOrder ?? 0
      return left - right
    })
  }, [draftSnapshot, versionSnapshot])

  const questionDiffMap = useMemo(
    () => new Map(questionDiffs.map((diff) => [diff.id, diff.kind])),
    [questionDiffs]
  )

  const snapshotPages = useMemo(
    () => buildSnapshotPages(versionSnapshot?.questions || [], tBuilder("defaultPageTitle")),
    [versionSnapshot?.questions, tBuilder]
  )

  const renderDiffBadge = (kind: DiffKind) => {
    const label =
      kind === "changed"
        ? tBuilder("versionDiffChanged")
        : kind === "added"
          ? tBuilder("versionDiffAdded")
          : tBuilder("versionDiffRemoved")

    return (
      <Badge variant="outline" className={`text-[10px] font-bold ${statusClasses[kind]}`}>
        {label}
      </Badge>
    )
  }

  const renderQuestionBody = (question: SnapshotQuestion) => {
    if (question.type === "single" || question.type === "multi" || question.type === "select") {
      const options = question.options || []
      if (options.length === 0) {
        return <p className="text-xs text-gray-500">-</p>
      }

      const markerClass =
        question.type === "multi"
          ? "h-2.5 w-2.5 rounded-[2px] border border-gray-400"
          : "h-2.5 w-2.5 rounded-full border border-gray-400"

      return (
        <ul className="space-y-1.5">
          {options.map((option, index) => (
            <li key={`${question.id}-option-${index}`} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <span className={markerClass} />
              <span>{option || "-"}</span>
            </li>
          ))}
        </ul>
      )
    }

    if (question.type === "rating") {
      const maxRating = Math.max(1, Math.min(question.maxRating || 5, 10))
      return (
        <div className="flex items-center gap-1">
          {Array.from({ length: maxRating }).map((_, index) => (
            <Star key={`${question.id}-star-${index}`} className="h-3.5 w-3.5 text-gray-300" />
          ))}
        </div>
      )
    }

    if (question.type === "date") {
      return <div className="h-8 w-40 rounded-md border border-dashed border-gray-300 bg-gray-50" />
    }

    if (question.type === "section") {
      return null
    }

    return <div className="h-8 w-full rounded-md border border-dashed border-gray-300 bg-gray-50" />
  }

  const hasAnyFieldDiff =
    hasFieldChanged("title") ||
    hasFieldChanged("description") ||
    hasFieldChanged("visibility") ||
    hasFieldChanged("includeInDatasets") ||
    hasFieldChanged("pointsReward") ||
    hasFieldChanged("expiresAt")

  if (!version || !versionSnapshot) {
    return (
      <div className={className}>
        <p className="text-xs text-gray-500">{tBuilder("versionSelectHint")}</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className || ""}`}>
      <div className="space-y-1">
        <div className="text-sm font-semibold">
          {tBuilder("versionPreviewTitle", { version: version.versionNumber })}
        </div>
        <p className="text-xs text-gray-500">{tBuilder("versionPreviewDescription")}</p>
      </div>

      <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/60">
        <div className="text-xs font-semibold text-gray-500">{tCommon("settings")}</div>
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">{versionSnapshot.title}</span>
            {hasFieldChanged("title") ? renderDiffBadge("changed") : null}
          </div>
          <div className="text-gray-600 dark:text-gray-300">
            {versionSnapshot.description || "-"}
            {hasFieldChanged("description") ? <div className="mt-1">{renderDiffBadge("changed")}</div> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {versionSnapshot.visibility === "public" ? tBuilder("visibilityPublic") : tBuilder("visibilityNonPublic")}
            </Badge>
            {hasFieldChanged("visibility") ? renderDiffBadge("changed") : null}
            <Badge variant="outline">
              {tBuilder("pointsReward")}: {versionSnapshot.pointsReward}
            </Badge>
            {hasFieldChanged("pointsReward") ? renderDiffBadge("changed") : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {tBuilder("datasetContributions")}: {versionSnapshot.includeInDatasets ? "ON" : "OFF"}
            </Badge>
            {hasFieldChanged("includeInDatasets") ? renderDiffBadge("changed") : null}
            <Badge variant="outline">
              {tBuilder("expirationDate")}: {formatUtcDateTime(versionSnapshot.expiresAt, { locale, timeZone }) || "-"}
            </Badge>
            {hasFieldChanged("expiresAt") ? renderDiffBadge("changed") : null}
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/60">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-500">{tBuilder("questions")}</div>
          <Badge variant="secondary">{versionSnapshot.questions.filter((question) => question.type !== "section").length}</Badge>
        </div>

        {snapshotPages.length === 0 ? (
          <p className="text-xs text-gray-500">-</p>
        ) : (
          <div className="space-y-3">
            {snapshotPages.map((page, pageIndex) => {
              const pageDiff = page.sourceQuestionId ? questionDiffMap.get(page.sourceQuestionId) : undefined
              return (
                <div key={page.id} className="rounded-xl border border-gray-200 bg-white/80 p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
                  <div className="rounded-lg bg-purple-600 p-3 text-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{page.title || `${tBuilder("defaultPageTitle")} ${pageIndex + 1}`}</div>
                        <p className="mt-0.5 text-xs text-white/80">{page.description || "-"}</p>
                      </div>
                      {pageDiff ? renderDiffBadge(pageDiff) : null}
                    </div>
                  </div>

                  <div className="ml-2 mt-3 space-y-2 border-l-2 border-gray-200 pl-3 dark:border-gray-700">
                    {page.questions.length === 0 ? (
                      <p className="text-xs text-gray-500">-</p>
                    ) : (
                      page.questions.map((question, index) => {
                        const questionDiff = questionDiffMap.get(question.id)
                        const typeKey = mapQuestionTypeKey(question.type)
                        const questionTypeLabel = typeKey ? tQuestion(typeKey) : question.type
                        return (
                          <div
                            key={question.id}
                            className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-900"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {index + 1}. {question.title || "-"}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[10px]">
                                  {questionTypeLabel}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">
                                  {question.required ? tBuilder("required") : tBuilder("optional")}
                                </Badge>
                                {questionDiff ? renderDiffBadge(questionDiff) : null}
                              </div>
                            </div>

                            {question.description ? (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{question.description}</p>
                            ) : null}

                            <div className="mt-2">{renderQuestionBody(question)}</div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {draftSnapshot ? (
        <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/60">
          <div className="text-xs font-semibold text-gray-500">{tBuilder("versionDiffTitle")}</div>
          {questionDiffs.length === 0 && !hasAnyFieldDiff ? (
            <p className="text-xs text-gray-500">{tBuilder("versionDiffNone")}</p>
          ) : (
            <div className="space-y-2">
              {questionDiffs.map((diff) => (
                <div
                  key={diff.id}
                  className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-medium text-gray-700 dark:text-gray-200">
                      {diff.versionQuestion?.title || diff.draftQuestion?.title || diff.id}
                    </div>
                    {renderDiffBadge(diff.kind)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
