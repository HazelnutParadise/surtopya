"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Eye,
  Pencil,
  BarChart3,
  Settings,
  Copy,
  Check,
  ExternalLink,
  Users,
  MessageSquare,
  TrendingUp,
  Calendar,
  Lock,
  Unlock,
  Send,
  Trash2,
} from "lucide-react";
import { getLocaleFromPath, withLocale } from "@/lib/locale";
import { useTimeZone, useTranslations } from "next-intl";
import {
  normalizeSurveyResponseAnalytics,
  type SurveyResponse,
  type SurveyResponseAnalytics,
  type SurveyVersion,
} from "@/lib/api";
import { mapApiSurveyToUi, SurveyDisplay } from "@/lib/survey-mappers";
import { getSurveyDatasetSharingEffectiveValue, isSurveyDatasetSharingLocked, isSurveyPublishLocked } from "@/lib/survey-publish-locks";
import { trackUIEvent } from "@/lib/ui-telemetry";
import { VersionDocumentPreview, type SurveyVersionSnapshotPreview } from "@/components/survey/version-document-preview";
import { ResponseAnalyticsPanel } from "@/components/survey/response-analytics-panel";
import {
  SurveyResponsesExportDialog,
  type SurveyResponsesExportEncoding,
  type SurveyResponsesExportScope,
} from "@/components/survey/survey-responses-export-menu";
import { buildCsvContent } from "@/lib/csv";
import { buildSurveyResponsesCsvRows } from "@/lib/survey-responses-csv"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUtcDateTime, utcToDatetimeLocal } from "@/lib/date-time";

const downloadCsv = (filename: string, rows: string[][], includeBom: boolean) => {
  const content = buildCsvContent(rows, {
    includeBom,
    lineBreak: "crlf",
  })
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function SurveyManagementPage() {
  const t = useTranslations("SurveyManagement");
  const tCommon = useTranslations("Common");
  const tDashboard = useTranslations("Dashboard");
  const tBuilder = useTranslations("SurveyBuilder");
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const timeZone = useTimeZone()
  const withLocalePath = (href: string) => withLocale(href, locale);
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<SurveyDisplay | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [analytics, setAnalytics] = useState<SurveyResponseAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [analyticsVersion, setAnalyticsVersion] = useState("all")
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [surveyVersions, setSurveyVersions] = useState<SurveyVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<SurveyVersion | null>(null)
  const [versionError, setVersionError] = useState<string | null>(null)
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null)
  const [restoringVersionNumber, setRestoringVersionNumber] = useState<number | null>(null)
  const [confirmRestoreVersionNumber, setConfirmRestoreVersionNumber] = useState<number | null>(null)
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [formState, setFormState] = useState({
    title: "",
    description: "",
    visibility: "non-public",
    requireLoginToRespond: false,
    includeInDatasets: false,
    pointsReward: 0,
    expiresAtLocal: "",
  });

  const loadSurveyVersions = useCallback(async () => {
    setVersionsLoading(true)
    setVersionError(null)
    try {
      const response = await fetch(`/api/surveys/${surveyId}/versions`, {
        cache: "no-store",
      })
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(errorPayload?.error || "Failed to load survey versions")
      }
      const payload = await response.json()
      const versions = payload.versions || []
      setSurveyVersions(versions)
      setSelectedVersion((previous) => {
        if (versions.length === 0) return null
        if (!previous) return versions[0]
        return versions.find((version: SurveyVersion) => version.id === previous.id) || versions[0]
      })
    } catch {
      setSurveyVersions([])
      setVersionError(tBuilder("versionLoadFailed"))
    } finally {
      setVersionsLoading(false)
    }
  }, [surveyId, tBuilder])

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchSurvey = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/surveys/${surveyId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (isMounted && response.ok) {
          setSurvey(mapApiSurveyToUi(payload));
        } else if (isMounted) {
          setSurvey(null);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load survey:", error);
          setSurvey(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const fetchResponses = async () => {
      try {
        const response = await fetch(`/api/surveys/${surveyId}/responses`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (isMounted && response.ok) {
          setResponses(payload.responses || []);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load responses:", error);
          setResponses([]);
        }
      }
    };

    const fetchCapabilities = async () => {
      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => ({}))
        if (isMounted && response.ok) {
          setCapabilities(payload.capabilities || {})
        }
      } catch {
        if (isMounted) {
          setCapabilities({})
        }
      }
    }

    fetchSurvey();
    fetchResponses();
    fetchCapabilities();
    void loadSurveyVersions()

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [loadSurveyVersions, surveyId]);

  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    const fetchAnalytics = async () => {
      setAnalyticsLoading(true)
      setAnalyticsError(null)

      try {
        const query = analyticsVersion === "all" ? "" : `?version=${encodeURIComponent(analyticsVersion)}`
        const response = await fetch(`/api/surveys/${surveyId}/responses/analytics${query}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.message || payload?.error || tCommon("error"))
        }

        if (isMounted) {
          setAnalytics(normalizeSurveyResponseAnalytics(payload, analyticsVersion))
        }
      } catch (error) {
        if (!isMounted || controller.signal.aborted) return
        console.error("Failed to load response analytics:", error)
        setAnalytics(null)
        setAnalyticsError(error instanceof Error ? error.message : tCommon("error"))
      } finally {
        if (isMounted && !controller.signal.aborted) {
          setAnalyticsLoading(false)
        }
      }
    }

    void fetchAnalytics()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [analyticsVersion, surveyId, tCommon])

  useEffect(() => {
    if (!survey) return;
    setFormState({
      title: survey.title,
      description: survey.description || "",
      visibility: survey.settings.visibility,
      requireLoginToRespond: survey.settings.requireLoginToRespond,
      includeInDatasets: survey.settings.isDatasetActive,
      pointsReward: survey.settings.pointsReward,
      expiresAtLocal: utcToDatetimeLocal(survey.settings.expiresAt, timeZone),
    });
  }, [survey, timeZone]);

  const completionRate = useMemo(() => {
    if (responses.length === 0) return 0;
    const completed = responses.filter((response) => response.status === "completed").length;
    return Math.round((completed / responses.length) * 100);
  }, [responses]);

  const lastResponse = useMemo(() => {
    if (responses.length === 0) return "";
    const latest = responses.reduce((latest, response) => {
      const candidate = response.completedAt || response.createdAt;
      if (!latest) return candidate;
      return new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest;
    }, "");
    return formatUtcDateTime(latest, { locale, timeZone });
  }, [locale, responses, timeZone]);

  const responseRows = useMemo(() => {
    return [...responses].sort((a, b) => {
      const aTime = new Date(a.completedAt || a.createdAt).getTime()
      const bTime = new Date(b.completedAt || b.createdAt).getTime()
      return bTime - aTime
    })
  }, [responses])

  const completedResponseCount = useMemo(
    () => responseRows.filter((response) => response.status === "completed").length,
    [responseRows]
  )

  const exportVersionOptions = useMemo(() => {
    return [...new Set(surveyVersions.map((version) => version.versionNumber))].sort((left, right) => right - left)
  }, [surveyVersions])

  const handleExportCsv = (scope: SurveyResponsesExportScope, encoding: SurveyResponsesExportEncoding) => {
    const rows = buildSurveyResponsesCsvRows({
      responses: responseRows,
      surveyVersions,
      metadataHeaders: {
        id: t("responsesTableId"),
        status: t("responsesTableStatus"),
        respondent: t("responsesTableRespondent"),
        points: t("responsesTablePoints"),
        startedAt: t("responsesTableStartedAt"),
        submittedAt: t("responsesTableSubmittedAt"),
      },
      exportScope: scope,
    })
    const scopeLabel = scope === "all" ? "all" : `v${scope}`
    downloadCsv(`responses-${surveyId}-${scopeLabel}.csv`, rows, encoding === "excel")
  }

  const handleAnalyticsVersionChange = useCallback((value: string) => {
    startTransition(() => {
      setAnalyticsVersion(value)
    })
  }, [])

  const handlePreview = () => {
    if (survey) {
      const surveyData = {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        questions: survey.questions,
        settings: survey.settings,
      };
      sessionStorage.setItem("preview_survey", JSON.stringify(surveyData));
      sessionStorage.setItem("preview_theme", JSON.stringify(survey.theme || {}));
      window.open(withLocalePath("/create/preview"), "_blank");
    }
  };

  const handleEdit = () => {
    router.push(withLocalePath(`/create?edit=${surveyId}`));
  };

  const handleViewSurvey = () => {
    window.open(withLocalePath(`/survey/${surveyId}`), "_blank", "noopener,noreferrer");
  };

  const handleDeleteSurvey = async () => {
    if (!window.confirm(t("deleteSurveyConfirm"))) return

    setDeleteError(null)
    setDeleting(true)
    try {
      const response = await fetch(`/api/surveys/${surveyId}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Delete failed")
      }
      router.replace(withLocalePath("/dashboard"))
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : tCommon("error"))
    } finally {
      setDeleting(false)
    }
  }

  const mapPublishStatusError = (rawError?: string) => {
    if (!rawError) return tCommon("error");
    if (rawError === "Active survey limit reached") return tBuilder("publishErrorActiveSurveyLimitReached");
    if (rawError === "No changes to publish") return tBuilder("noChangesToPublish");
    if (rawError === "Survey responses are closed") return tBuilder("responsesClosed");
    if (rawError === "Published version expired") return tBuilder("publishedVersionExpired");
    return rawError;
  };

  const handleTogglePublish = async (status: boolean) => {
    if (!survey) return;
    setPublishing(true);
    setPublishError(null);
    void trackUIEvent({
      screen: "survey_admin_detail",
      component: "publish_toggle",
      event_name: status ? "open_request" : "close_request",
      resource_id: surveyId,
    })
    try {
      const hasPublishedVersion = Boolean(
        survey.settings.currentPublishedVersionNumber &&
          survey.settings.currentPublishedVersionNumber > 0
      )
      const endpoint = status
        ? hasPublishedVersion
          ? "responses/open"
          : "publish"
        : "responses/close"
      const response = await fetch(`/api/surveys/${surveyId}/${endpoint}`, {
        method: "POST",
        headers: status && !hasPublishedVersion ? { "Content-Type": "application/json" } : undefined,
        body: status && !hasPublishedVersion
          ? JSON.stringify({
              visibility: survey.settings.visibility,
              includeInDatasets: survey.settings.isDatasetActive,
              pointsReward: survey.settings.pointsReward,
            })
          : undefined,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(mapPublishStatusError(payload?.error));
      }
      setSurvey(mapApiSurveyToUi(payload));
      if (endpoint === "publish") {
        void loadSurveyVersions()
      }
      void trackUIEvent({
        screen: "survey_admin_detail",
        component: "publish_toggle",
        event_name: endpoint === "publish" ? "publish_success" : status ? "open_success" : "close_success",
        resource_id: surveyId,
      })
    } catch (error) {
      console.error("Failed to update publish status:", error);
      setPublishError(error instanceof Error ? error.message : tCommon("error"));
      void trackUIEvent({
        screen: "survey_admin_detail",
        component: "publish_toggle",
        event_name: "error",
        resource_id: surveyId,
        metadata: {
          message: error instanceof Error ? error.message : tCommon("error"),
        },
      })
    } finally {
      setPublishing(false);
    }
  };

  const restoreVersionToDraft = async (versionNumber: number) => {
    setRestoringVersionNumber(versionNumber)
    setVersionError(null)
    setRestoreNotice(null)
    void trackUIEvent({
      screen: "survey_admin_detail",
      component: "restore_version",
      event_name: "submit",
      resource_id: surveyId,
      metadata: { version_number: versionNumber },
    })
    try {
      const response = await fetch(`/api/surveys/${surveyId}/versions/${versionNumber}/restore-draft`, {
        method: "POST",
      })
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(errorPayload?.error || "Failed to restore survey version")
      }
      const payload = await response.json()
      setSurvey(mapApiSurveyToUi(payload))
      setRestoreNotice(tBuilder("restoredToDraft"))
      void trackUIEvent({
        screen: "survey_admin_detail",
        component: "restore_version",
        event_name: "success",
        resource_id: surveyId,
        metadata: { version_number: versionNumber },
      })
    } catch {
      setVersionError(tBuilder("versionRestoreFailed"))
      void trackUIEvent({
        screen: "survey_admin_detail",
        component: "restore_version",
        event_name: "error",
        resource_id: surveyId,
        metadata: { version_number: versionNumber },
      })
    } finally {
      setRestoringVersionNumber(null)
    }
  }

  const confirmRestoreVersionToDraft = async () => {
    if (confirmRestoreVersionNumber == null) return
    const targetVersion = confirmRestoreVersionNumber
    setConfirmRestoreVersionNumber(null)
    await restoreVersionToDraft(targetVersion)
  }

  const handleSaveSettings = async () => {
    if (!survey) return;
    setSaving(true);
    setSaveError(null);
    void trackUIEvent({
      screen: "survey_admin_detail",
      component: "settings_form",
      event_name: "submit",
      resource_id: surveyId,
    })

    const payload = {
      title: formState.title.trim() || survey.title,
      description: formState.description,
      visibility: formState.visibility,
      requireLoginToRespond: formState.requireLoginToRespond,
      includeInDatasets: getSurveyDatasetSharingEffectiveValue({
        capabilities,
        visibility: formState.visibility,
        includeInDatasets: formState.includeInDatasets,
      }),
      pointsReward: formState.pointsReward,
      expiresAtLocal: formState.expiresAtLocal,
      timeZone,
    };

    try {
      const response = await fetch(`/api/surveys/${surveyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save survey settings");
      }
      setSurvey(mapApiSurveyToUi(data));
      void trackUIEvent({
        screen: "survey_admin_detail",
        component: "settings_form",
        event_name: "success",
        resource_id: surveyId,
      })
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveError(tCommon("error"));
      void trackUIEvent({
        screen: "survey_admin_detail",
        component: "settings_form",
        event_name: "error",
        resource_id: surveyId,
      })
    } finally {
      setSaving(false);
    }
  };

  const handleResetSettings = () => {
    if (!survey) return;
    setFormState({
      title: survey.title,
      description: survey.description || "",
      visibility: survey.settings.visibility,
      requireLoginToRespond: survey.settings.requireLoginToRespond,
      includeInDatasets: survey.settings.isDatasetActive,
      pointsReward: survey.settings.pointsReward,
      expiresAtLocal: utcToDatetimeLocal(survey.settings.expiresAt, timeZone),
    });
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}${withLocalePath(`/survey/${surveyId}`)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Fallback copy failed", err);
      }
      document.body.removeChild(textArea);
    }
  };

  const draftSnapshot: SurveyVersionSnapshotPreview | null = useMemo(() => {
    if (!survey) return null
    return {
      title: survey.title,
      description: survey.description,
      visibility: survey.settings.visibility,
      includeInDatasets: survey.settings.isDatasetActive,
      pointsReward: survey.settings.pointsReward,
      expiresAt: survey.settings.expiresAt,
      questions: survey.questions.map((question, index) => ({
        id: question.id,
        type: question.type,
        title: question.title,
        description: question.description || undefined,
        options: question.options || [],
        required: question.required,
        maxRating: question.maxRating,
        logic: question.logic,
        sortOrder: index,
      })),
    }
  }, [survey])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("notFoundTitle")}</h1>
          <p className="text-gray-500">{t("notFoundDescription")}</p>
          <Button onClick={() => router.push(withLocalePath("/dashboard"))} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToDashboard")}
          </Button>
        </div>
      </div>
    );
  }

  const isDirty =
    formState.title !== survey.title ||
    formState.description !== (survey.description || "") ||
    formState.visibility !== survey.settings.visibility ||
    formState.requireLoginToRespond !== survey.settings.requireLoginToRespond ||
    formState.includeInDatasets !== survey.settings.isDatasetActive ||
    formState.pointsReward !== survey.settings.pointsReward ||
    formState.expiresAtLocal !== utcToDatetimeLocal(survey.settings.expiresAt, timeZone);

  const publishedCount = survey.settings.publishedCount ?? 0
  const hasPublishedVersion = Boolean(
    survey.settings.currentPublishedVersionNumber &&
      survey.settings.currentPublishedVersionNumber > 0
  )
  const canSwitchToPublic = publishedCount === 0 || survey.settings.visibility === "public";
  const isPublishLocked = isSurveyPublishLocked(publishedCount)
  const isDatasetSharingLocked = isSurveyDatasetSharingLocked({
    publishedCount,
    capabilities,
    visibility: formState.visibility,
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push(withLocalePath("/dashboard"))}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{survey.title}</h1>
                <p className="text-sm text-gray-500">
                  {t("createdOn", {
                    date: formatUtcDateTime(survey.createdAt, { locale, timeZone }) || "",
                  })}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    hasPublishedVersion
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  }
                >
                  {hasPublishedVersion ? tDashboard("published") : tDashboard("draft")}
                </Badge>
                <Button variant="outline" onClick={handlePreview}>
                  <Eye className="mr-2 h-4 w-4" />
                  {tCommon("preview")}
                </Button>
                <Button variant="outline" onClick={handleViewSurvey}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("viewSurvey")}
                </Button>
                {hasPublishedVersion ? (
                  <Button
                    variant="outline"
                    className={
                      survey.settings.isResponseOpen
                        ? "text-amber-600 border-amber-200 hover:bg-amber-50"
                        : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    }
                    onClick={() => handleTogglePublish(!survey.settings.isResponseOpen)}
                    disabled={publishing}
                  >
                    {survey.settings.isResponseOpen ? (
                      <Lock className="mr-2 h-4 w-4" />
                    ) : (
                      <Unlock className="mr-2 h-4 w-4" />
                    )}
                    {survey.settings.isResponseOpen ? tCommon("closeResponses") : tCommon("openResponses")}
                  </Button>
                ) : (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleTogglePublish(true)}
                    disabled={publishing || isDirty}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {tCommon("publish")}
                  </Button>
                )}
                <Button onClick={handleEdit} variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50">
                  <Pencil className="mr-2 h-4 w-4" />
                  {tCommon("edit")}
                </Button>
              </div>
              {publishError ? <p className="text-sm text-red-600">{publishError}</p> : null}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("totalResponses")}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{survey.responseCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("completionRate")}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{completionRate}%</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("lastResponse")}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{lastResponse || "--"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("questions")}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {survey.questions.filter((q) => q.type !== "section").length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Tabs defaultValue="responses" className="w-full">
              <TabsList className="w-full justify-start bg-white dark:bg-gray-900 border-b rounded-none p-0 h-auto">
                <TabsTrigger value="responses" className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600 px-6 py-3">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  {t("responsesTab")}
                </TabsTrigger>
                <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600 px-6 py-3">
                  <Settings className="mr-2 h-4 w-4" />
                  {tCommon("settings")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="responses" className="mt-6 space-y-6">
                <ResponseAnalyticsPanel
                  analytics={analytics}
                  loading={analyticsLoading}
                  error={analyticsError}
                  selectedVersion={analyticsVersion}
                  onVersionChange={handleAnalyticsVersionChange}
                />
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle>{t("responseSummaryTitle")}</CardTitle>
                        <CardDescription>{t("responseSummaryDescription")}</CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <SurveyResponsesExportDialog
                          disabled={completedResponseCount === 0}
                          availableVersions={exportVersionOptions}
                          onExport={handleExportCsv}
                        />
                        <Button
                          variant="outline"
                          onClick={handleViewSurvey}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {t("viewSurvey")}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t("exportCsvHint")}</p>
                  </CardHeader>
                  <CardContent>
                    {responses.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                        <BarChart3 className="h-12 w-12 mb-4 text-gray-300" />
                        <p>{t("noResponsesYet")}</p>
                        <p className="text-sm mt-2">{t("responseAnalyticsPlaceholder")}</p>
                      </div>
                    ) : (
                      <div data-testid="dashboard-responses-table" className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                            <tr>
                              <th className="py-2 pr-4 font-medium">{t("responsesTableStatus")}</th>
                              <th className="py-2 pr-4 font-medium">{t("responsesTableSubmittedAt")}</th>
                              <th className="py-2 pr-4 font-medium">{t("responsesTablePoints")}</th>
                              <th className="py-2 pr-4 font-medium">{t("responsesTableRespondent")}</th>
                              <th className="py-2 pr-4 font-medium">{t("responsesTableId")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {responseRows.map((response) => {
                              const submittedAt = response.completedAt || response.createdAt
                              const respondentLabel = response.userId || response.anonymousId || "--"
                              const statusLabel =
                                response.status === "completed"
                                  ? t("statusCompleted")
                                  : response.status === "in_progress"
                                    ? t("statusInProgress")
                                    : t("statusAbandoned")

                              return (
                                <tr
                                  key={response.id}
                                  className="border-b border-gray-100 dark:border-gray-900/60"
                                >
                                  <td className="py-3 pr-4">
                                    <Badge
                                      className={
                                        response.status === "completed"
                                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                          : response.status === "in_progress"
                                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                      }
                                    >
                                      {statusLabel}
                                    </Badge>
                                  </td>
                                  <td className="py-3 pr-4 whitespace-nowrap">
                                    {formatUtcDateTime(submittedAt, { locale, timeZone }) || "--"}
                                  </td>
                                  <td className="py-3 pr-4">{response.pointsAwarded ?? 0}</td>
                                  <td className="py-3 pr-4 max-w-[240px] truncate" title={respondentLabel}>
                                    {respondentLabel}
                                  </td>
                                  <td className="py-3 pr-4 font-mono text-xs max-w-[220px] truncate" title={response.id}>
                                    {response.id}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle>{t("surveySettingsTitle")}</CardTitle>
                        <CardDescription>{t("surveySettingsDescription")}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleResetSettings} disabled={!isDirty || saving}>
                          {tCommon("cancel")}
                        </Button>
                        <Button onClick={handleSaveSettings} disabled={!isDirty || saving}>
                          {saving ? tCommon("saving") : tCommon("save")}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="survey-title">{tBuilder("surveyTitle")}</Label>
                      <Input
                        id="survey-title"
                        value={formState.title}
                        onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="survey-description">{tBuilder("description")}</Label>
                      <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden bg-white dark:bg-gray-900">
                        <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.getElementById("survey-description-textarea") as HTMLTextAreaElement | null;
                              if (!textarea) return;
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const text = textarea.value;
                              const selected = text.substring(start, end);
                              const newText = text.substring(0, start) + "**" + selected + "**" + text.substring(end);
                              setFormState((prev) => ({ ...prev, description: newText }));
                            }}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                            title={tBuilder("formatBold")}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                              <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.getElementById("survey-description-textarea") as HTMLTextAreaElement | null;
                              if (!textarea) return;
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const text = textarea.value;
                              const selected = text.substring(start, end);
                              const newText = text.substring(0, start) + "_" + selected + "_" + text.substring(end);
                              setFormState((prev) => ({ ...prev, description: newText }));
                            }}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                            title={tBuilder("formatItalic")}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="19" x2="10" y1="4" y2="4" />
                              <line x1="14" x2="5" y1="20" y2="20" />
                              <line x1="15" x2="9" y1="4" y2="20" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.getElementById("survey-description-textarea") as HTMLTextAreaElement | null;
                              if (!textarea) return;
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const text = textarea.value;
                              const selected = text.substring(start, end);
                              const url = prompt(tBuilder("linkPrompt"), "https://");
                              if (!url) return;
                              const linkText = selected || tBuilder("linkText");
                              const newText = text.substring(0, start) + "[" + linkText + "](" + url + ")" + text.substring(end);
                              setFormState((prev) => ({ ...prev, description: newText }));
                            }}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                            title={tBuilder("formatLink")}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                          </button>
                          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.getElementById("survey-description-textarea") as HTMLTextAreaElement | null;
                              if (!textarea) return;
                              const start = textarea.selectionStart;
                              const text = textarea.value;
                              const newText = text.substring(0, start) + "\n- " + text.substring(start);
                              setFormState((prev) => ({ ...prev, description: newText }));
                            }}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                            title={tBuilder("formatBulletList")}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="8" x2="21" y1="6" y2="6" />
                              <line x1="8" x2="21" y1="12" y2="12" />
                              <line x1="8" x2="21" y1="18" y2="18" />
                              <line x1="3" x2="3.01" y1="6" y2="6" />
                              <line x1="3" x2="3.01" y1="12" y2="12" />
                              <line x1="3" x2="3.01" y1="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                        <textarea
                          id="survey-description-textarea"
                          value={formState.description}
                          onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                          rows={5}
                          placeholder={tBuilder("descriptionPlaceholder")}
                          className="w-full min-h-[120px] bg-transparent px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none resize-none"
                        />
                      </div>
                      <p className="text-xs text-gray-500">{tBuilder("supportsMarkdown")}</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-base">{t("visibilityLabel")}</Label>
                      <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
                        <button
                          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                            formState.visibility === "public"
                              ? "bg-white dark:bg-gray-700 shadow-sm"
                              : "text-gray-500"
                          }`}
                          data-testid="survey-settings-visibility-public"
                          disabled={isPublishLocked || !canSwitchToPublic}
                          onClick={() => setFormState((prev) => ({ ...prev, visibility: "public" }))}
                        >
                          {t("public")}
                        </button>
                        <button
                          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                            formState.visibility === "non-public"
                              ? "bg-white dark:bg-gray-700 shadow-sm"
                              : "text-gray-500"
                          }`}
                          data-testid="survey-settings-visibility-nonpublic"
                          disabled={isPublishLocked}
                          onClick={() => setFormState((prev) => ({ ...prev, visibility: "non-public" }))}
                        >
                          {t("nonPublic")}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formState.visibility === "public"
                          ? t("visibilityPublicDescription")
                          : t("visibilityNonPublicDescription")}
                      </p>
                      {isPublishLocked ? (
                        <p
                          className="text-xs text-gray-500 mt-1 flex items-center gap-1"
                          data-testid="survey-settings-publish-locked-hint"
                        >
                          <Lock className="h-3 w-3" />
                          {t("settingsLockedAfterPublish")}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3">
                      <div className="space-y-1 pr-4">
                        <Label className="text-base">{tBuilder("requireLoginToRespondLabel")}</Label>
                        <p className="text-sm text-gray-500">{tBuilder("requireLoginToRespondDescription")}</p>
                      </div>
                      <Switch
                        checked={formState.requireLoginToRespond}
                        onCheckedChange={(value) =>
                          setFormState((prev) => ({ ...prev, requireLoginToRespond: value }))
                        }
                        data-testid="survey-settings-require-login"
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-6">
                      <div className="space-y-0.5">
                        <Label htmlFor="dataset" className="text-base">
                          {t("datasetProgramLabel")}
                        </Label>
                        <p className="text-xs text-gray-500">
                          {formState.visibility === "public"
                            ? t("datasetProgramPublicDescription")
                            : t("datasetProgramNonPublicDescription")}
                        </p>
                      </div>
                      <Switch
                        id="dataset"
                        checked={getSurveyDatasetSharingEffectiveValue({
                          capabilities,
                          visibility: formState.visibility,
                          includeInDatasets: formState.includeInDatasets,
                        })}
                        onCheckedChange={(value) => setFormState((prev) => ({ ...prev, includeInDatasets: value }))}
                        disabled={isDatasetSharingLocked}
                        data-testid="survey-settings-include-in-datasets"
                      />
                    </div>

                    <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-6">
                      <Label htmlFor="expires">{t("expirationDate")}</Label>
                      <div className="flex gap-4 items-center">
                        <Input
                          id="expires"
                          type="datetime-local"
                          value={formState.expiresAtLocal}
                          className="max-w-[200px]"
                          onChange={(event) =>
                            setFormState((prev) => ({ ...prev, expiresAtLocal: event.target.value }))
                          }
                        />
                        <span className="text-xs text-gray-500 italic">{t("expirationHint")}</span>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-6">
                      <Label htmlFor="points">{t("pointsReward")}</Label>
                      <Input
                        id="points"
                        type="number"
                        value={formState.pointsReward}
                        className="w-32"
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            pointsReward: Number(event.target.value || 0),
                          }))
                        }
                      />
                      <p className="text-sm text-gray-500">{t("pointsRewardDescription")}</p>
                    </div>

                    {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("shareLink")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}${withLocalePath(`/survey/${surveyId}`)}`}
                    className="text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyLink}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("quickActions")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={handlePreview}>
                  <Eye className="mr-2 h-4 w-4" />
                  {t("previewSurvey")}
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("editSurvey")}
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleViewSurvey}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("openSurveyPage")}
                </Button>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={handleDeleteSurvey}
                  disabled={deleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleting ? tCommon("saving") : t("deleteSurvey")}
                </Button>
                {deleteError ? <p className="text-xs text-red-600">{deleteError}</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tBuilder("versionHistory")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {versionsLoading ? (
                  <p className="text-xs text-gray-500">{tCommon("loading")}</p>
                ) : surveyVersions.length === 0 ? (
                  <p className="text-xs text-gray-500">{tBuilder("versionEmpty")}</p>
                ) : (
                  <div className="space-y-2">
                    {surveyVersions.map((version) => (
                      <div key={version.id} className="rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-2 py-1.5">
                        <div className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
                          {tBuilder("versionLabel", { version: version.versionNumber })}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setSelectedVersion(version)}>
                            {tBuilder("viewVersion")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => setConfirmRestoreVersionNumber(version.versionNumber)}
                            disabled={restoringVersionNumber === version.versionNumber}
                          >
                            {restoringVersionNumber === version.versionNumber ? tCommon("saving") : tBuilder("restoreToDraft")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {versionError ? <p className="text-xs text-red-600">{versionError}</p> : null}
                {restoreNotice ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{restoreNotice}</p> : null}
                <VersionDocumentPreview
                  version={selectedVersion}
                  draftSnapshot={draftSnapshot}
                  className="max-h-[460px] overflow-y-auto"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={confirmRestoreVersionNumber != null} onOpenChange={(open) => !open && setConfirmRestoreVersionNumber(null)}>
        <DialogContent onInteractOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{tBuilder("restoreDraftConfirmTitle")}</DialogTitle>
            <DialogDescription>{tBuilder("restoreDraftConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestoreVersionNumber(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRestoreVersionToDraft}
              disabled={confirmRestoreVersionNumber == null || restoringVersionNumber != null}
            >
              {tBuilder("restoreDraftConfirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
