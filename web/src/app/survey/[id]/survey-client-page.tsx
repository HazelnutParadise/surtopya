"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { SurveyRenderer } from "@/components/survey/survey-renderer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Clock,
  Users,
  Award,
  ArrowRight,
  ArrowLeft,
  X,
  CheckSquare,
  AlignLeft,
  BarChart,
  Calendar,
  Save,
  AlertCircle,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SurveyDisplay } from "@/lib/survey-mappers"
import { SurveyTheme } from "@/types/survey"
import { getLocaleFromPath, withLocale } from "@/lib/locale"
import { useTranslations } from "next-intl"
import type { UserProfile } from "@/lib/api"
import {
  analyzeDraftGuestMerge,
  buildSubmitAnswers,
  resolveDraftGuestMerge,
  toRendererAnswers,
  type MergeSource,
} from "@/lib/response-submit"
import {
  clearAnonymousClaimContext,
  writeAnonymousClaimContext,
  type AnonymousClaimContext,
} from "@/lib/anonymous-claim"

const RichText = ({ content }: { content: string }) => {
  if (!content) return null

  const parts = content.split(/(\*\*.*?\*\*|_[^_]+_|\[.*?\]\(.*?\)|^- .*$)/gm)

  return (
    <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-gray-900 dark:text-gray-200">
              {part.slice(2, -2)}
            </strong>
          )
        }
        if (part.startsWith("_") && part.endsWith("_")) {
          return (
            <em key={i} className="italic">
              {part.slice(1, -1)}
            </em>
          )
        }
        if (part.match(/\[(.*?)\]\((.*?)\)/)) {
          const match = part.match(/\[(.*?)\]\((.*?)\)/)
          return (
            <a
              key={i}
              href={match![2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:underline"
            >
              {match![1]}
            </a>
          )
        }
        if (part.trim().startsWith("- ")) {
          return (
            <div key={i} className="flex items-start gap-2 ml-4 my-1">
              <div className="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400 flex-shrink-0" />
              <span>{part.trim().substring(2)}</span>
            </div>
          )
        }
        return part
      })}
    </div>
  )
}

interface SurveyClientPageProps {
  initialSurvey?: SurveyDisplay
  surveyId: string
  isPreview?: boolean
  surveyBasePoints: number
}

type SaveStatus = "idle" | "saving" | "saved" | "retrying" | "failed"
type FlushStatus = "saved" | "failed" | "skipped"
type SubmissionState = "available" | "already_submitted"
type FlushReason =
  | "autosave"
  | "exit_button"
  | "popstate"
  | "beforeunload"
  | "pagehide"
  | "in_app_nav"
type DraftAnswer = {
  questionId: string
  value?: {
    value?: string
    values?: string[]
    text?: string
    rating?: number
    date?: string
  }
}

const loginRequiredToRespondCode = "LOGIN_REQUIRED_TO_RESPOND"
const alreadySubmittedCode = "ALREADY_SUBMITTED"

type FlowApiError = Error & {
  code?: string
  status?: number
}

type MergeConflictState = {
  draftId: string
  draftAnswers: Record<string, unknown>
  guestAnswers: Record<string, unknown>
  conflictQuestionIds: string[]
}

const guestAnswersStorageKey = (surveyId: string) => `surtopya:guest_answers:${surveyId}`

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const readGuestAnswers = (surveyId: string): Record<string, unknown> => {
  if (typeof window === "undefined") return {}

  try {
    const raw = sessionStorage.getItem(guestAnswersStorageKey(surveyId))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const writeGuestAnswers = (surveyId: string, answers: Record<string, unknown>) => {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(guestAnswersStorageKey(surveyId), JSON.stringify(answers))
  } catch {
    // Ignore storage errors (private mode / quota) and continue as in-memory only.
  }
}

const clearGuestAnswers = (surveyId: string) => {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(guestAnswersStorageKey(surveyId))
  } catch {
    // Ignore.
  }
}

const toFlowApiError = (payload: unknown, status: number, fallbackMessage: string): FlowApiError => {
  const payloadRecord = isRecord(payload) ? payload : {}
  const message =
    typeof payloadRecord.error === "string" && payloadRecord.error.length > 0
      ? payloadRecord.error
      : fallbackMessage
  const error = new Error(message) as FlowApiError
  error.status = status
  if (typeof payloadRecord.code === "string") {
    error.code = payloadRecord.code
  }
  return error
}

const isAlreadySubmittedError = (value: unknown) => {
  if (!value || typeof value !== "object") return false
  return (value as { code?: unknown }).code === alreadySubmittedCode
}

export function SurveyClientPage({
  initialSurvey,
  surveyId,
  isPreview = false,
  surveyBasePoints,
}: SurveyClientPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locale = getLocaleFromPath(pathname)
  const withLocalePath = useCallback((href: string) => withLocale(href, locale), [locale])
  const t = useTranslations("SurveyPage")
  const tCard = useTranslations("SurveyCard")
  const tCommon = useTranslations("Common")

  const previewData = useMemo(() => {
    if (!isPreview || typeof window === "undefined") {
      return { survey: null as SurveyDisplay | null, theme: undefined as SurveyTheme | undefined }
    }
    try {
      const surveyData = sessionStorage.getItem("preview_survey")
      const themeData = sessionStorage.getItem("preview_theme")
      const parsedSurvey = surveyData ? (JSON.parse(surveyData) as SurveyDisplay) : null
      const parsedTheme = themeData ? (JSON.parse(themeData) as SurveyTheme) : undefined
      return {
        survey: parsedSurvey
          ? {
              ...parsedSurvey,
              responseCount: 0,
            }
          : null,
        theme: parsedTheme,
      }
    } catch (error) {
      console.error("Failed to load preview data:", error)
      return { survey: null as SurveyDisplay | null, theme: undefined as SurveyTheme | undefined }
    }
  }, [isPreview])

  const [survey] = useState<SurveyDisplay | null>(initialSurvey || previewData.survey || null)
  const [theme] = useState<SurveyTheme | undefined>(previewData.theme)
  const [loading] = useState(false)

  const [isTaking, setIsTaking] = useState(Boolean(previewData.survey))
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [flowError, setFlowError] = useState<string | null>(null)
  const [submissionState, setSubmissionState] = useState<SubmissionState>("available")

  const [authLoading, setAuthLoading] = useState(!isPreview)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [rendererAnswers, setRendererAnswers] = useState<Record<string, unknown>>({})
  const [rendererSessionKey, setRendererSessionKey] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [exitDialogMode, setExitDialogMode] = useState<"saved" | "failed">("saved")
  const [leaveHandling, setLeaveHandling] = useState(false)
  const [mergeConflictState, setMergeConflictState] = useState<MergeConflictState | null>(null)
  const [mergeApplyingSource, setMergeApplyingSource] = useState<MergeSource | null>(null)
  const [mergeSaveError, setMergeSaveError] = useState<string | null>(null)

  const saveDebounceRef = useRef<number | null>(null)
  const rendererAnswersRef = useRef<Record<string, unknown>>({})
  const isDirtyRef = useRef(false)
  const pendingLeaveActionRef = useRef<(() => void) | null>(null)
  const suppressPopstateRef = useRef(false)
  const resumeAfterLoginRef = useRef(false)

  const isLoggedIn = Boolean(currentUser)
  const resumeAfterLogin = searchParams.get("resume") === "1"
  const requiresLoginToRespond = Boolean(survey?.settings.requireLoginToRespond)
  const canGuestRespond = !requiresLoginToRespond

  const rewardEstimate = survey
    ? surveyBasePoints + Math.floor((survey.settings.pointsReward || 0) / 3)
    : 0

  const questionMap = useMemo(() => {
    const map = new Map<string, SurveyDisplay["questions"][number]>()
    if (!survey) return map
    for (const question of survey.questions) {
      if (question.type === "section") continue
      map.set(question.id, question)
    }
    return map
  }, [survey])

  const formatConflictAnswer = useCallback(
    (questionId: string, raw: unknown) => {
      const question = questionMap.get(questionId)
      if (!question) return t("mergeConflictValueFallback")

      switch (question.type) {
        case "multi": {
          if (Array.isArray(raw)) {
            const values = raw
              .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
              .sort((a, b) => a.localeCompare(b))
            return values.length > 0 ? values.join(", ") : t("mergeConflictValueFallback")
          }
          return t("mergeConflictValueFallback")
        }
        case "rating": {
          if (typeof raw === "number" && Number.isFinite(raw)) {
            return String(raw)
          }
          if (typeof raw === "string" && raw.trim().length > 0) {
            return raw.trim()
          }
          return t("mergeConflictValueFallback")
        }
        default: {
          if (typeof raw === "string" && raw.trim().length > 0) {
            return raw.trim()
          }
          if (Array.isArray(raw)) {
            return raw.join(", ")
          }
          return t("mergeConflictValueFallback")
        }
      }
    },
    [questionMap, t]
  )

  const formatSavedTime = useCallback(
    (date: Date) => {
      try {
        return new Intl.DateTimeFormat(locale, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(date)
      } catch {
        return date.toLocaleTimeString()
      }
    },
    [locale]
  )

  const loginHref = useCallback(
    (resume: boolean) => {
      const params = new URLSearchParams(searchParams.toString())
      if (resume) {
        params.set("resume", "1")
      } else {
        params.delete("resume")
      }

      const query = params.toString()
      const returnTo = query ? `${pathname}?${query}` : pathname
      return `/api/logto/sign-in?returnTo=${encodeURIComponent(returnTo)}`
    },
    [pathname, searchParams]
  )

  const setAnswersSnapshot = useCallback((nextAnswers: Record<string, unknown>) => {
    rendererAnswersRef.current = nextAnswers
    setRendererAnswers(nextAnswers)
  }, [])

  const persistDraftBulk = useCallback(
    async (
      targetDraftId: string,
      answersSnapshot: Record<string, unknown>,
      options?: { bestEffort?: boolean }
    ): Promise<FlushStatus> => {
      if (!survey || !targetDraftId) return "failed"

      const answers = buildSubmitAnswers(survey, answersSnapshot)
      if (answers.length === 0) {
        return "skipped"
      }

      const body = JSON.stringify({ answers })
      const endpoint = `/api/drafts/${targetDraftId}/answers/bulk`

      if (options?.bestEffort) {
        let queued = false
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          try {
            queued = navigator.sendBeacon(
              endpoint,
              new Blob([body], { type: "application/json" })
            )
          } catch {
            queued = false
          }
        }

        if (!queued) {
          void fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
            credentials: "same-origin",
          }).catch(() => undefined)
        }

        return "saved"
      }

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        })

        if (!response.ok) {
          return "failed"
        }

        return "saved"
      } catch {
        return "failed"
      }
    },
    [survey]
  )

  const flushProgress = useCallback(
    async (
      reason: FlushReason,
      options?: { bestEffort?: boolean; force?: boolean }
    ): Promise<FlushStatus> => {
      if (isPreview || !survey || !isTaking) return "skipped"
      if (!options?.force && !isDirtyRef.current) return "skipped"

      if (!isLoggedIn) {
        writeGuestAnswers(surveyId, rendererAnswersRef.current)
        isDirtyRef.current = false
        return "saved"
      }

      if (!draftId) {
        return "failed"
      }

      if (!options?.bestEffort) {
        setSaveStatus("saving")
      }

      const attemptPersist = async (attempt: number): Promise<FlushStatus> => {
        const result = await persistDraftBulk(draftId, rendererAnswersRef.current, {
          bestEffort: options?.bestEffort,
        })

        if (result === "failed" && !options?.bestEffort && attempt === 0) {
          setSaveStatus("retrying")
          await new Promise((resolve) => {
            window.setTimeout(resolve, 1200)
          })
          return attemptPersist(1)
        }

        return result
      }

      const result = await attemptPersist(0)

      if (result === "saved" || result === "skipped") {
        isDirtyRef.current = false
        if (!options?.bestEffort) {
          setSaveStatus("saved")
          setLastSavedAt(formatSavedTime(new Date()))
        }
        return result
      }

      if (!options?.bestEffort) {
        setSaveStatus("failed")
      }
      if (reason === "beforeunload" || reason === "pagehide") {
        return "saved"
      }
      return "failed"
    },
    [draftId, formatSavedTime, isLoggedIn, isPreview, isTaking, persistDraftBulk, survey, surveyId]
  )

  const scheduleDraftSave = useCallback(() => {
    if (saveDebounceRef.current !== null) {
      window.clearTimeout(saveDebounceRef.current)
    }
    saveDebounceRef.current = window.setTimeout(() => {
      void flushProgress("autosave")
    }, 700)
  }, [flushProgress])

  const startDraftSession = useCallback(async (): Promise<{
    draftId: string | null
    requiresMergeDecision: boolean
  }> => {
    const response = await fetch(`/api/surveys/${surveyId}/drafts/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload?.id) {
      throw toFlowApiError(payload, response.status, "Failed to start response draft")
    }

    const nextDraftId = String(payload.id)
    setDraftId(nextDraftId)
    setMergeConflictState(null)
    setMergeSaveError(null)

    const draftAnswers = toRendererAnswers(
      Array.isArray(payload.answers) ? (payload.answers as DraftAnswer[]) : undefined
    )
    const guestAnswers = readGuestAnswers(surveyId)
    const hasGuestAnswers = Object.keys(guestAnswers).length > 0

    if (!hasGuestAnswers || !survey) {
      setAnswersSnapshot(draftAnswers)
      isDirtyRef.current = false

      if (Object.keys(draftAnswers).length > 0) {
        setSaveStatus("saved")
        setLastSavedAt(formatSavedTime(new Date()))
      } else {
        setSaveStatus("idle")
        setLastSavedAt(null)
      }

      return { draftId: nextDraftId, requiresMergeDecision: false }
    }

    const mergeAnalysis = analyzeDraftGuestMerge(survey, draftAnswers, guestAnswers)

    if (mergeAnalysis.conflictQuestionIds.length > 0) {
      setMergeSaveError(null)
      setMergeConflictState({
        draftId: nextDraftId,
        draftAnswers,
        guestAnswers,
        conflictQuestionIds: mergeAnalysis.conflictQuestionIds,
      })

      return { draftId: nextDraftId, requiresMergeDecision: true }
    }

    const mergedAnswers = mergeAnalysis.mergedNonConflictingAnswers
    setAnswersSnapshot(mergedAnswers)
    isDirtyRef.current = false

    const migrated = await persistDraftBulk(nextDraftId, mergedAnswers)
    if (migrated === "saved" || migrated === "skipped") {
      clearGuestAnswers(surveyId)
      if (Object.keys(mergedAnswers).length > 0) {
        setSaveStatus("saved")
        setLastSavedAt(formatSavedTime(new Date()))
      } else {
        setSaveStatus("idle")
        setLastSavedAt(null)
      }
    } else {
      setSaveStatus("failed")
    }

    return { draftId: nextDraftId, requiresMergeDecision: false }
  }, [formatSavedTime, persistDraftBulk, setAnswersSnapshot, survey, surveyId])

  const clearProgressForAlreadySubmitted = useCallback(() => {
    clearGuestAnswers(surveyId)
    setDraftId(null)
    setAnswersSnapshot({})
    setSaveStatus("idle")
    setLastSavedAt(null)
    setMergeConflictState(null)
    setMergeSaveError(null)
    setIsTaking(false)
    setSubmissionState("already_submitted")
    isDirtyRef.current = false
  }, [setAnswersSnapshot, surveyId])

  useEffect(() => {
    // Reset local one-time-submit state when account or survey context changes.
    setSubmissionState("available")
  }, [currentUser?.id, surveyId])

  const handleStartSurvey = useCallback(async () => {
    setFlowError(null)
    if (isPreview) {
      setRendererSessionKey((prev) => prev + 1)
      setIsTaking(true)
      return
    }
    if (!survey) return
    if (!survey.settings.isResponseOpen) {
      setFlowError(t("responsesNotOpen"))
      return
    }
    if (!isLoggedIn && survey.settings.requireLoginToRespond) {
      setFlowError(t("loginRequiredToRespondDescription"))
      return
    }

    setStarting(true)
    try {
      if (isLoggedIn) {
        const startResult = await startDraftSession()
        if (startResult.requiresMergeDecision) {
          return
        }
      } else {
        setDraftId(null)
        setSaveStatus("idle")
        setLastSavedAt(null)
        setMergeConflictState(null)
        setMergeSaveError(null)
        setAnswersSnapshot(readGuestAnswers(surveyId))
        isDirtyRef.current = false
      }

      setRendererSessionKey((prev) => prev + 1)
      setIsTaking(true)
    } catch (error) {
      if (isAlreadySubmittedError(error)) {
        clearProgressForAlreadySubmitted()
        setFlowError(t("alreadySubmittedDescription"))
        return
      }
      console.error("Failed to start survey:", error)
      setFlowError(tCommon("error"))
    } finally {
      setStarting(false)
    }
  }, [
    clearProgressForAlreadySubmitted,
    isLoggedIn,
    isPreview,
    setAnswersSnapshot,
    startDraftSession,
    survey,
    surveyId,
    t,
    tCommon,
  ])

  const handleAnswerChange = useCallback(
    (_questionId: string, _value: unknown, allAnswers: Record<string, unknown>) => {
      setAnswersSnapshot(allAnswers)
      isDirtyRef.current = true

      if (isPreview || !survey) {
        return
      }

      if (!isLoggedIn) {
        writeGuestAnswers(surveyId, allAnswers)
        isDirtyRef.current = false
        return
      }

      if (!draftId) {
        return
      }

      scheduleDraftSave()
    },
    [draftId, isLoggedIn, isPreview, scheduleDraftSave, setAnswersSnapshot, survey, surveyId]
  )

  const handleComplete = useCallback(
    async (answers: Record<string, unknown>) => {
      setFlowError(null)
      if (!survey) return

      if (isPreview) {
        console.info(
          `${t("previewCompleteTitle")}\n\n${t("previewCompleteDescription")}\n\n${t("previewCompleteResponses")}\n` +
            JSON.stringify(answers, null, 2)
        )
        return
      }

      setSubmitting(true)
      try {
        if (saveDebounceRef.current !== null) {
          window.clearTimeout(saveDebounceRef.current)
          saveDebounceRef.current = null
        }
        await flushProgress("autosave", { force: true })

        const submitPayload = { answers: buildSubmitAnswers(survey, answers) }

        let response: Response
        if (isLoggedIn) {
          let targetDraftId = draftId
          if (!targetDraftId) {
            const startResult = await startDraftSession()
            if (startResult.requiresMergeDecision) {
              throw new Error("Merge conflict requires selection")
            }
            targetDraftId = startResult.draftId
          }
          if (!targetDraftId) {
            throw new Error("Missing response draft")
          }

          response = await fetch(`/api/drafts/${targetDraftId}/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(submitPayload),
          })
        } else {
          response = await fetch(`/api/surveys/${surveyId}/responses/submit-anonymous`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(submitPayload),
          })
        }

        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (payload?.code === alreadySubmittedCode) {
            clearProgressForAlreadySubmitted()
            setFlowError(t("alreadySubmittedDescription"))
            return
          }
          if (!isLoggedIn && payload?.code === loginRequiredToRespondCode) {
            setIsTaking(false)
            setFlowError(t("loginRequiredToRespondDescription"))
          }
          throw toFlowApiError(payload, response.status, "Submit failed")
        }

        clearGuestAnswers(surveyId)

        const pointsAwardedRaw = payload?.pointsAwarded
        const pointsAwarded =
          typeof pointsAwardedRaw === "number"
            ? pointsAwardedRaw
            : Number(pointsAwardedRaw || 0)
        const pointsParam = Number.isFinite(pointsAwarded)
          ? Math.max(0, Math.floor(pointsAwarded))
          : 0
        if (!isLoggedIn) {
          const claimContext = payload?.claimContext
          if (
            claimContext &&
            typeof claimContext.responseId === "string" &&
            typeof claimContext.claimToken === "string"
          ) {
            writeAnonymousClaimContext({
              responseId: claimContext.responseId,
              claimToken: claimContext.claimToken,
              pointsAwarded:
                typeof claimContext.pointsAwarded === "number"
                  ? claimContext.pointsAwarded
                  : Number(claimContext.pointsAwarded || 0),
              expiresAt:
                typeof claimContext.expiresAt === "string"
                  ? claimContext.expiresAt
                  : new Date().toISOString(),
              status:
                claimContext.status === "claimed" || claimContext.status === "forfeited"
                  ? claimContext.status
                  : "pending",
            } satisfies AnonymousClaimContext)
          } else if (payload?.response?.id && typeof payload.response.id === "string") {
            clearAnonymousClaimContext(payload.response.id)
          }
        }
        const qs = new URLSearchParams({ points: String(pointsParam) }).toString()

        router.push(withLocalePath(`/survey/thank-you?${qs}`))
      } catch (error) {
        if (isAlreadySubmittedError(error)) {
          clearProgressForAlreadySubmitted()
          setFlowError(t("alreadySubmittedDescription"))
          return
        }
        console.error("Failed to submit response:", error)
        setFlowError(tCommon("error"))
      } finally {
        setSubmitting(false)
      }
    },
    [
      draftId,
      clearProgressForAlreadySubmitted,
      flushProgress,
      isLoggedIn,
      isPreview,
      router,
      startDraftSession,
      survey,
      surveyId,
      t,
      tCommon,
      withLocalePath,
    ]
  )

  useEffect(() => {
    if (isPreview) {
      setAuthLoading(false)
      setCurrentUser(null)
      return
    }

    let alive = true
    const controller = new AbortController()

    const loadAuth = async () => {
      setAuthLoading(true)
      try {
        const response = await fetch("/api/me?optional=1", {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!alive) return

        if (!response.ok) {
          setCurrentUser(null)
          return
        }

        const payload = await response.json().catch(() => null)
        setCurrentUser(payload)
      } catch {
        if (alive) {
          setCurrentUser(null)
        }
      } finally {
        if (alive) {
          setAuthLoading(false)
        }
      }
    }

    void loadAuth()

    return () => {
      alive = false
      controller.abort()
    }
  }, [isPreview])

  useEffect(() => {
    if (isPreview || !resumeAfterLogin) return
    if (resumeAfterLoginRef.current) return
    if (authLoading || !isLoggedIn || !survey || isTaking) return

    resumeAfterLoginRef.current = true
    void handleStartSurvey()
  }, [authLoading, handleStartSurvey, isLoggedIn, isPreview, isTaking, resumeAfterLogin, survey])

  useEffect(() => {
    if (isPreview || !survey || !isTaking || authLoading) return
    if (isLoggedIn) return
    if (!survey.settings.requireLoginToRespond) return

    setIsTaking(false)
    setFlowError(t("loginRequiredToRespondDescription"))
  }, [authLoading, isLoggedIn, isPreview, isTaking, survey, t])

  useEffect(() => {
    if (isPreview || isLoggedIn) {
      return
    }

    setAnswersSnapshot(readGuestAnswers(surveyId))
    isDirtyRef.current = false
  }, [isLoggedIn, isPreview, setAnswersSnapshot, surveyId])

  useEffect(() => {
    return () => {
      if (saveDebounceRef.current !== null) {
        window.clearTimeout(saveDebounceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isPreview || !survey || loading || isTaking) return

    const currentTitleParam = searchParams.get("title")
    const expectedTitleSlug = encodeURIComponent(survey.title.replace(/\s+/g, "-").toLowerCase())

    if (currentTitleParam !== expectedTitleSlug) {
      const newPath = withLocalePath(`/survey/${surveyId}?title=${expectedTitleSlug}`)
      router.replace(newPath, { scroll: false })
    }
  }, [isPreview, survey, survey?.title, surveyId, searchParams, router, loading, isTaking, withLocalePath])

  const runLeaveFlow = useCallback(
    async ({
      reason,
      action,
      showDialogOnSuccess,
    }: {
      reason: FlushReason
      action: () => void
      showDialogOnSuccess: boolean
    }) => {
      setFlowError(null)
      setLeaveHandling(true)
      const result = await flushProgress(reason, { force: true })

      if (showDialogOnSuccess || result === "failed") {
        pendingLeaveActionRef.current = action
        setExitDialogMode(result === "failed" ? "failed" : "saved")
        setShowExitDialog(true)
      } else {
        action()
      }

      setLeaveHandling(false)
    },
    [flushProgress]
  )

  useEffect(() => {
    if (isPreview || !isTaking) return

    const onBeforeUnload = () => {
      void flushProgress("beforeunload", { bestEffort: true, force: true })
    }
    const onPageHide = () => {
      void flushProgress("pagehide", { bestEffort: true, force: true })
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [flushProgress, isPreview, isTaking])

  useEffect(() => {
    if (isPreview || !isTaking) return

    const marker = { surtopyaSurveyGuard: surveyId }
    window.history.pushState(marker, "", window.location.href)

    const onPopState = () => {
      if (suppressPopstateRef.current) {
        return
      }

      window.history.pushState(marker, "", window.location.href)
      void runLeaveFlow({
        reason: "popstate",
        action: () => {
          suppressPopstateRef.current = true
          window.history.back()
          window.setTimeout(() => {
            suppressPopstateRef.current = false
          }, 0)
        },
        showDialogOnSuccess: true,
      })
    }

    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("popstate", onPopState)
    }
  }, [isPreview, isTaking, runLeaveFlow, surveyId])

  useEffect(() => {
    if (isPreview || !isTaking) return

    const onDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target as HTMLElement | null
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target && anchor.target !== "_self") return

      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#")) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return

      event.preventDefault()
      void runLeaveFlow({
        reason: "in_app_nav",
        action: () => {
          window.location.assign(url.toString())
        },
        showDialogOnSuccess: false,
      })
    }

    document.addEventListener("click", onDocumentClick, true)
    return () => {
      document.removeEventListener("click", onDocumentClick, true)
    }
  }, [isPreview, isTaking, runLeaveFlow])

  const handleExitClick = () => {
    if (isPreview) {
      window.close()
      return
    }

    void runLeaveFlow({
      reason: "exit_button",
      action: () => {
        setIsTaking(false)
      },
      showDialogOnSuccess: true,
    })
  }

  const handleConfirmExit = () => {
    setShowExitDialog(false)
    const action = pendingLeaveActionRef.current
    pendingLeaveActionRef.current = null
    if (action) {
      action()
      return
    }
    setIsTaking(false)
  }

  const mergeConflictDetails = useMemo(() => {
    if (!mergeConflictState) return []

    return mergeConflictState.conflictQuestionIds.map((questionId) => {
      const question = questionMap.get(questionId)
      return {
        questionId,
        title: question?.title || t("mergeConflictUnknownQuestion"),
        guestValue: formatConflictAnswer(questionId, mergeConflictState.guestAnswers[questionId]),
        draftValue: formatConflictAnswer(questionId, mergeConflictState.draftAnswers[questionId]),
      }
    })
  }, [formatConflictAnswer, mergeConflictState, questionMap, t])

  const handleResolveMergeConflict = useCallback(
    async (source: MergeSource) => {
      if (!mergeConflictState || !survey) return

      setMergeApplyingSource(source)
      setMergeSaveError(null)
      setSaveStatus("saving")

      const resolvedAnswers = resolveDraftGuestMerge(
        survey,
        mergeConflictState.draftAnswers,
        mergeConflictState.guestAnswers,
        source
      )
      setAnswersSnapshot(resolvedAnswers)

      const saveResult = await persistDraftBulk(mergeConflictState.draftId, resolvedAnswers)
      if (saveResult !== "saved" && saveResult !== "skipped") {
        setSaveStatus("failed")
        setMergeSaveError(t("mergeConflictSaveFailed"))
        setMergeApplyingSource(null)
        return
      }

      clearGuestAnswers(surveyId)
      isDirtyRef.current = false
      setSaveStatus("saved")
      setLastSavedAt(formatSavedTime(new Date()))
      setMergeConflictState(null)
      setMergeApplyingSource(null)
      setRendererSessionKey((prev) => prev + 1)
      setIsTaking(true)
    },
    [formatSavedTime, mergeConflictState, persistDraftBulk, setAnswersSnapshot, survey, surveyId, t]
  )

  const saveStatusLabel = useMemo(() => {
    if (!isLoggedIn || isPreview) return null

    switch (saveStatus) {
      case "saving":
        return t("saveStatusSaving")
      case "saved":
        return lastSavedAt
          ? t("saveStatusAt", { time: lastSavedAt })
          : t("saveStatusSaved")
      case "retrying":
        return t("saveStatusRetrying")
      case "failed":
        return t("saveStatusFailed")
      default:
        return t("saveStatusSaved")
    }
  }, [isLoggedIn, isPreview, lastSavedAt, saveStatus, t])

  const questionTypes = survey
    ? Array.from(new Set(survey.questions.map((q) => q.type))).filter((type) => type !== "section")
    : []
  const isAlreadySubmitted = submissionState === "already_submitted"

  const getTypeDescription = (type: string) => {
    switch (type) {
      case "single":
        return t("typeDescriptionSingle")
      case "multi":
        return t("typeDescriptionMulti")
      case "text":
      case "short":
      case "long":
        return t("typeDescriptionText")
      case "rating":
        return t("typeDescriptionRating")
      case "select":
        return t("typeDescriptionSelect")
      case "date":
        return t("typeDescriptionDate")
      default:
        return t("typeDescriptionDefault")
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "single":
      case "multi":
        return <CheckSquare className="w-4 h-4 text-purple-600" />
      case "text":
      case "short":
      case "long":
        return <AlignLeft className="w-4 h-4 text-purple-600" />
      case "rating":
        return <BarChart className="w-4 h-4 text-purple-600" />
      case "date":
        return <Calendar className="w-4 h-4 text-purple-600" />
      default:
        return <AlignLeft className="w-4 h-4 text-purple-600" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-950 dark:to-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("notFoundTitle")}</h1>
          <p className="text-gray-500">
            {isPreview ? t("notFoundPreviewDescription") : t("notFoundDescription")}
          </p>
          <Button onClick={() => router.push(withLocalePath(isPreview ? "/create" : "/explore"))} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isPreview ? t("backToBuilder") : t("backToMarketplace")}
          </Button>
        </div>
      </div>
    )
  }

  if (isTaking) {
    const showGuestTakingPrompt = !isPreview && !authLoading && !isLoggedIn && canGuestRespond
    const leaveDialogTitle =
      exitDialogMode === "failed"
        ? t("leaveDialogFailedTitle")
        : isLoggedIn
          ? t("leaveDialogSavedTitle")
          : t("leaveDialogGuestSavedTitle")
    const leaveDialogDescription =
      exitDialogMode === "failed"
        ? t("leaveDialogFailedDescription")
        : isLoggedIn
          ? t("leaveDialogSavedDescription")
          : t("leaveDialogGuestSavedDescription")

    return (
      <div className="relative">
        <div className="fixed top-4 right-4 z-[60]">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExitClick}
            disabled={leaveHandling}
            className="bg-white/90 backdrop-blur shadow-lg hover:bg-white"
          >
            <X className="mr-2 h-4 w-4" />
            {leaveHandling ? tCommon("saving") : isPreview ? t("exitPreview") : t("exitSurvey")}
          </Button>
        </div>

        <SurveyRenderer
          key={rendererSessionKey}
          survey={survey}
          theme={theme}
          isPreview={isPreview}
          initialAnswers={rendererAnswers}
          onAnswerChange={handleAnswerChange}
          onComplete={handleComplete}
          noticeBar={
            <>
              {showGuestTakingPrompt ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-left text-sm text-amber-900">
                  <p className="font-medium">{t("takingGuestNotice")}</p>
                  <div className="mt-2">
                    <Button asChild size="sm" className="h-8 bg-amber-600 hover:bg-amber-700 text-white">
                      <a href={loginHref(true)}>{t("takingGuestNoticeAction")}</a>
                    </Button>
                  </div>
                </div>
              ) : null}

              {!isPreview && isLoggedIn && saveStatusLabel ? (
                <div className="rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-xs text-gray-700 flex items-center gap-2">
                  {saveStatus === "failed" ? (
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Save className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                  <span>{saveStatusLabel}</span>
                </div>
              ) : null}
            </>
          }
        />

        {flowError ? (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] w-[min(720px,calc(100vw-2rem))] rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
            {flowError}
          </div>
        ) : null}

        <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
          <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{leaveDialogTitle}</DialogTitle>
              <DialogDescription>{leaveDialogDescription}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  pendingLeaveActionRef.current = null
                  setShowExitDialog(false)
                }}
              >
                {t("leaveContinueButton")}
              </Button>
              <Button variant={exitDialogMode === "failed" ? "destructive" : "default"} onClick={handleConfirmExit}>
                {t("leaveSurveyButton")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {!isPreview && <Navbar />}

      <main className="flex-1 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
            <div className="flex items-center gap-2 mb-6">
              <Badge className="bg-white/20 text-white border-0 hover:bg-white/30 text-sm px-3 py-1">
                <Award className="mr-1.5 h-4 w-4" />
                {t("earnPoints", { points: rewardEstimate })}
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">{survey.title}</h1>
            {survey.creatorName && <p className="text-xl text-white/80">by {survey.creatorName}</p>}
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            <article className="md:col-span-2 space-y-8">
              <section>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t("aboutTitle")}</h2>
                <RichText content={survey.description} />
              </section>

              <section>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  {t("questionPreviewTitle")}
                </h3>
                <ul className="space-y-3 text-gray-600 dark:text-gray-400">
                  {questionTypes.length > 0 ? (
                    questionTypes.map((type) => (
                      <li key={type} className="flex items-center gap-3">
                        <div className="flex-shrink-0 p-1 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                          {getTypeIcon(type)}
                        </div>
                        <span>{getTypeDescription(type)}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-500 italic">{t("noQuestions")}</li>
                  )}
                </ul>
              </section>

              <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t("privacyTitle")}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t("privacyDescription")}</p>
              </div>

              {!isPreview ? (
                <div className="p-5 rounded-2xl border border-indigo-200 bg-indigo-50/80 dark:border-indigo-800/60 dark:bg-indigo-950/30">
                  {authLoading ? (
                    <p className="text-sm text-indigo-800 dark:text-indigo-200">{tCommon("loading")}</p>
                  ) : isLoggedIn ? (
                    <>
                      <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                        {t("progressNoticeMemberTitle")}
                      </p>
                      <p className="mt-1 text-sm text-indigo-800 dark:text-indigo-200">
                        {t("progressNoticeMemberDescription")}
                      </p>
                    </>
                  ) : requiresLoginToRespond ? (
                    <>
                      <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                        {t("loginRequiredToRespondTitle")}
                      </p>
                      <p className="mt-1 text-sm text-indigo-800 dark:text-indigo-200">
                        {t("loginRequiredToRespondDescription")}
                      </p>
                      <div className="mt-3">
                        <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                          <a href={loginHref(false)}>{t("loginRequiredToRespondAction")}</a>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                        {t("progressNoticeGuestTitle")}
                      </p>
                      <p className="mt-1 text-sm text-indigo-800 dark:text-indigo-200">
                        {t("progressNoticeGuestDescription")}
                      </p>
                      <div className="mt-3">
                        <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                          <a href={loginHref(false)}>{t("progressNoticeGuestAction")}</a>
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {!isPreview && flowError && !isTaking && !isAlreadySubmitted ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {flowError}
                </div>
              ) : null}
            </article>

            <aside className="space-y-6">
              <Card className="border-0 shadow-xl overflow-hidden sticky top-8">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4">
                  <p className="text-white/80 text-sm">{t("rewardLabel")}</p>
                  <p className="text-3xl font-bold text-white">{t("pointsValue", { points: rewardEstimate })}</p>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t("estimatedTime")}</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {survey.estimatedMinutes
                          ? tCard("minutes", { count: survey.estimatedMinutes })
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t("responsesLabel")}</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {survey.responseCount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>

                <div className="p-4 pt-0">
                  <Button
                    onClick={handleStartSurvey}
                    size="lg"
                    disabled={
                      starting ||
                      submitting ||
                      isAlreadySubmitted ||
                      (!isPreview && !survey.settings.isResponseOpen) ||
                      (!isPreview && !isLoggedIn && requiresLoginToRespond)
                    }
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-lg py-6 shadow-lg shadow-purple-500/25 mb-4"
                  >
                    {isAlreadySubmitted
                      ? t("alreadySubmittedActionDisabled")
                      : starting
                        ? tCommon("loading")
                        : t("startSurvey")}
                    {!isAlreadySubmitted ? <ArrowRight className="ml-2 h-5 w-5" /> : null}
                  </Button>
                  {!isPreview && isAlreadySubmitted ? (
                    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                      <p className="text-sm font-semibold text-red-800">{t("alreadySubmittedTitle")}</p>
                      <p className="mt-1 text-sm text-red-700">{t("alreadySubmittedDescription")}</p>
                    </div>
                  ) : null}
                  {!isPreview && !isLoggedIn && requiresLoginToRespond ? (
                    <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      {t("loginRequiredToRespondDescription")}
                    </p>
                  ) : null}
                  {!isPreview && !survey.settings.isResponseOpen ? (
                    <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      {t("responsesNotOpen")}
                    </p>
                  ) : null}

                  <Button variant="ghost" onClick={() => router.push(withLocalePath("/explore"))} className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("backToMarketplace")}
                  </Button>
                </div>
              </Card>
            </aside>
          </div>
        </div>
      </main>

      <Dialog
        open={Boolean(mergeConflictState)}
        onOpenChange={() => {
          // Intentionally non-closable: user must choose one source.
        }}
      >
        <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t("mergeConflictTitle")}</DialogTitle>
            <DialogDescription>
              {t("mergeConflictDescription", { count: mergeConflictDetails.length })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {mergeConflictDetails.map((item) => (
              <div key={item.questionId} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <p className="font-medium text-gray-900">{item.title}</p>
                <p className="mt-1 text-gray-700">
                  {t("mergeConflictGuestLabel")}: <span className="font-medium">{item.guestValue}</span>
                </p>
                <p className="text-gray-700">
                  {t("mergeConflictDraftLabel")}: <span className="font-medium">{item.draftValue}</span>
                </p>
              </div>
            ))}
          </div>

          {mergeSaveError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {mergeSaveError}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={mergeApplyingSource !== null}
              onClick={() => {
                void handleResolveMergeConflict("draft")
              }}
            >
              {mergeApplyingSource === "draft" ? tCommon("saving") : t("mergeConflictUseDraft")}
            </Button>
            <Button
              disabled={mergeApplyingSource !== null}
              onClick={() => {
                void handleResolveMergeConflict("guest")
              }}
            >
              {mergeApplyingSource === "guest" ? tCommon("saving") : t("mergeConflictUseGuest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
