"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import type { SurveyVersion } from "@/lib/api"

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

const normalizeDate = (value?: string) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 10)
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

  const versionSnapshot = version?.snapshot

  const hasFieldChanged = (field: keyof SurveyVersionSnapshotPreview) => {
    if (!versionSnapshot || !draftSnapshot) return false
    if (field === "expiresAt") {
      return normalizeDate(versionSnapshot.expiresAt) !== normalizeDate(draftSnapshot.expiresAt)
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
          <div>
            <div className="font-medium">{versionSnapshot.title}</div>
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
              {tBuilder("datasetContributions")}: {versionSnapshot.includeInDatasets ? "Yes" : "No"}
            </Badge>
            {hasFieldChanged("includeInDatasets") ? renderDiffBadge("changed") : null}
            <Badge variant="outline">
              {tBuilder("expirationDate")}: {normalizeDate(versionSnapshot.expiresAt) || "-"}
            </Badge>
            {hasFieldChanged("expiresAt") ? renderDiffBadge("changed") : null}
          </div>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/60">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-500">{tBuilder("questions")}</div>
          <Badge variant="secondary">{versionSnapshot.questions.length}</Badge>
        </div>
        <div className="space-y-2">
          {versionSnapshot.questions.map((question) => (
            <div
              key={question.id}
              className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="font-medium">{question.title}</div>
              <div className="mt-1 text-gray-500">
                {question.type}
                {question.required ? " · required" : ""}
              </div>
            </div>
          ))}
          {versionSnapshot.questions.length === 0 ? (
            <p className="text-xs text-gray-500">-</p>
          ) : null}
        </div>
      </section>

      {draftSnapshot ? (
        <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/60">
          <div className="text-xs font-semibold text-gray-500">{tBuilder("versionDiffTitle")}</div>
          {questionDiffs.length === 0 &&
          !hasFieldChanged("title") &&
          !hasFieldChanged("description") &&
          !hasFieldChanged("visibility") &&
          !hasFieldChanged("includeInDatasets") &&
          !hasFieldChanged("pointsReward") &&
          !hasFieldChanged("expiresAt") ? (
            <p className="text-xs text-gray-500">{tBuilder("versionDiffNone")}</p>
          ) : (
            <div className="space-y-2">
              {questionDiffs.map((diff) => (
                <div
                  key={diff.id}
                  className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">
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
