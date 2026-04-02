"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTimeZone, useTranslations } from "next-intl";
import type {
  AgentAdminAccount,
  AdminUser,
  Capability,
  Dataset,
  MembershipTier,
  PolicyMatrixEntry,
  PolicyWriter,
  Survey,
  SurveyVersion,
  UserProfile,
} from "@/lib/api";
import { trackUIEvent } from "@/lib/ui-telemetry";
import { utcToDateOnly } from "@/lib/date-time";
import { notifyPointsBalanceChanged } from "@/lib/points-balance-events";
import { resolveUiError, toUiErrorMessage } from "@/lib/ui-error";
import { getLocaleFromPath, withLocale } from "@/lib/locale";

const PAGE_SIZE = 20;
const AGENT_PERMISSIONS = [
  "logs.read",
  "deid.read",
  "deid.write",
  "surveys.read",
  "surveys.write",
  "datasets.read",
  "datasets.write",
  "users.read",
  "users.write",
  "policies.read",
  "policies.write",
  "plans.read",
  "plans.write",
  "system.read",
  "system.write",
  "agents.read",
  "agents.write",
] as const;

const AGENT_PERMISSION_DESCRIPTION_KEYS: Record<
  (typeof AGENT_PERMISSIONS)[number],
  string
> = {
  "logs.read": "agentPermissionLogsRead",
  "deid.read": "agentPermissionDeidRead",
  "deid.write": "agentPermissionDeidWrite",
  "surveys.read": "agentPermissionSurveysRead",
  "surveys.write": "agentPermissionSurveysWrite",
  "datasets.read": "agentPermissionDatasetsRead",
  "datasets.write": "agentPermissionDatasetsWrite",
  "users.read": "agentPermissionUsersRead",
  "users.write": "agentPermissionUsersWrite",
  "policies.read": "agentPermissionPoliciesRead",
  "policies.write": "agentPermissionPoliciesWrite",
  "plans.read": "agentPermissionPlansRead",
  "plans.write": "agentPermissionPlansWrite",
  "system.read": "agentPermissionSystemRead",
  "system.write": "agentPermissionSystemWrite",
  "agents.read": "agentPermissionAgentsRead",
  "agents.write": "agentPermissionAgentsWrite",
};

type PointsUnderflowStrategy =
  | "reject_all"
  | "skip_insufficient"
  | "floor_zero";

type PointsAdjustInsufficientUser = {
  userId: string;
  pointsBalance: number;
  requiredDeduction: number;
};

type PendingPointsAdjustRequest = {
  userIds: string[];
  delta: number;
  reason: string;
};

type AdminDatasetVersion = {
  id: string;
  versionNumber: number;
  accessType: "free" | "paid";
  price: number;
  sampleSize: number;
  downloadCount: number;
  publishedAt?: string;
};

type DeidReviewJob = {
  id: string;
  survey_id: string;
  survey_title: string;
  status: string;
  trigger_source: string;
  current_chunk_index: number;
  chunk_size: number;
  total_chunks: number;
  summary_json?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

type DeidReviewColumn = {
  col_no: number;
  name: string;
};

type DeidReviewRowCell = {
  col_no: number;
  value: string;
};

type DeidReviewRow = {
  row_no: number;
  cells: DeidReviewRowCell[];
};

type DeidReviewDetail = {
  job: Record<string, unknown>;
  columns: DeidReviewColumn[];
  preview_rows: DeidReviewRow[];
  total_rows: number;
};

export default function AdminPage() {
  const pathname = usePathname()
  const locale = getLocaleFromPath(pathname ?? "/")
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const timeZone = useTimeZone()
  const getAdminError = (payload: unknown, fallbackKey: string) =>
    resolveUiError(payload, tAdmin(fallbackKey))
  const getErrorMessage = (error: unknown, fallbackKey: string) =>
    toUiErrorMessage(error, tAdmin(fallbackKey))

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [surveySearch, setSurveySearch] = useState("");
  const [datasetSearch, setDatasetSearch] = useState("");
  const [surveyVisibility, setSurveyVisibility] = useState("all");
  const [surveyPublished, setSurveyPublished] = useState("all");
  const [datasetActive, setDatasetActive] = useState("all");
  const [surveyLoading, setSurveyLoading] = useState(true);
  const [datasetLoading, setDatasetLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);
  const [adminUserLoading, setAdminUserLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [agentAccounts, setAgentAccounts] = useState<AgentAdminAccount[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userTierFilter, setUserTierFilter] = useState("all");
  const [userDisabledFilter, setUserDisabledFilter] = useState("all");
  const [usersSubTab, setUsersSubTab] = useState<"management" | "points_tool">(
    "management",
  );
  const [userReloadTick, setUserReloadTick] = useState(0);
  const [pointsToolSearch, setPointsToolSearch] = useState("");
  const [pointsToolTierFilter, setPointsToolTierFilter] = useState("all");
  const [pointsToolDisabledFilter, setPointsToolDisabledFilter] = useState("all");
  const [pointsToolUsers, setPointsToolUsers] = useState<AdminUser[]>([]);
  const [pointsToolLoading, setPointsToolLoading] = useState(true);
  const [pointsToolReloadTick, setPointsToolReloadTick] = useState(0);
  const [selectedPointsUserIds, setSelectedPointsUserIds] = useState<string[]>(
    [],
  );
  const [pointsDeltaDraft, setPointsDeltaDraft] = useState("0");
  const [pointsReasonDraft, setPointsReasonDraft] = useState("");
  const [applyingPointsAdjust, setApplyingPointsAdjust] = useState(false);
  const [insufficientDialogOpen, setInsufficientDialogOpen] = useState(false);
  const [pendingPointsAdjustRequest, setPendingPointsAdjustRequest] =
    useState<PendingPointsAdjustRequest | null>(null);
  const [insufficientUsers, setInsufficientUsers] = useState<
    PointsAdjustInsufficientUser[]
  >([]);
  const [adminReloadTick, setAdminReloadTick] = useState(0);
  const [addAdminDialogOpen, setAddAdminDialogOpen] = useState(false);
  const [addAdminSearch, setAddAdminSearch] = useState("");
  const [addAdminCandidates, setAddAdminCandidates] = useState<AdminUser[]>([]);
  const [addAdminCandidatesLoading, setAddAdminCandidatesLoading] =
    useState(false);
  const [selectedAddAdminUserId, setSelectedAddAdminUserId] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");
  const [agentOwnerFilter, setAgentOwnerFilter] = useState("all");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingAgentId, setSavingAgentId] = useState<string | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [policySaving, setPolicySaving] = useState(false);
  const [systemSettingsLoading, setSystemSettingsLoading] = useState(true);
  const [savingSystemSettings, setSavingSystemSettings] = useState(false);
  const [surveyBasePointsDraft, setSurveyBasePointsDraft] = useState(1);
  const [signupInitialPointsDraft, setSignupInitialPointsDraft] = useState(0);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [matrix, setMatrix] = useState<PolicyMatrixEntry[]>([]);
  const [policyWriters, setPolicyWriters] = useState<PolicyWriter[]>([]);
  const [savingPolicyWriterId, setSavingPolicyWriterId] = useState<
    string | null
  >(null);
  const [membershipDrafts, setMembershipDrafts] = useState<
    Record<
      string,
      {
        membershipTier: string;
        membershipIsPermanent: boolean;
        membershipPeriodEndAt: string;
      }
    >
  >({});
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [deactivatingPlanId, setDeactivatingPlanId] = useState<string | null>(
    null,
  );
  const [planRetirementDrafts, setPlanRetirementDrafts] = useState<
    Record<
      string,
      {
        replacementTierCode: string;
        executionTiming: "immediate" | "on_expiry";
      }
    >
  >({});
  const [savingCapabilityId, setSavingCapabilityId] = useState<string | null>(
    null,
  );
  const [newPlan, setNewPlan] = useState({
    code: "",
    nameI18n: { "zh-TW": "", en: "", ja: "" } as Record<string, string>,
    descriptionI18n: { "zh-TW": "", en: "", ja: "" } as Record<string, string>,
    isPurchasable: false,
    showOnPricing: false,
    priceCentsUsd: 0,
    billingInterval: "month",
    allowRenewalForExisting: false,
    monthlyPointsGrant: 0,
    maxActiveSurveys: null as number | null,
  });
  const [newPlanFieldErrors, setNewPlanFieldErrors] = useState<
    Record<string, string>
  >({});

  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [surveyForm, setSurveyForm] = useState({
    title: "",
    description: "",
    visibility: "non-public",
    includeInDatasets: false,
    isResponseOpen: false,
    pointsReward: 0,
  });
  const [datasetForm, setDatasetForm] = useState({
    title: "",
    description: "",
    category: "",
    accessType: "free",
    price: 0,
    sampleSize: 0,
    isActive: true,
    entitlementPolicy: "purchased_only" as "purchased_only" | "all_versions_if_any_purchase",
  });
  const [datasetVersionUploadFile, setDatasetVersionUploadFile] = useState<File | null>(null);
  const datasetVersionFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    surveyId: "",
    title: "",
    description: "",
    category: "other",
    accessType: "free",
    price: 0,
    sampleSize: 0,
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingDataset, setUploadingDataset] = useState(false);
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [savingDataset, setSavingDataset] = useState(false);
  const [datasetVersions, setDatasetVersions] = useState<AdminDatasetVersion[]>(
    [],
  );
  const [datasetVersionsLoading, setDatasetVersionsLoading] = useState(false);
  const [publishingDatasetVersion, setPublishingDatasetVersion] =
    useState(false);
  const [surveyVersions, setSurveyVersions] = useState<SurveyVersion[]>([]);
  const [surveyVersionsLoading, setSurveyVersionsLoading] = useState(false);
  const [publishingSurveyVersion, setPublishingSurveyVersion] = useState(false);
  const [togglingSurveyResponses, setTogglingSurveyResponses] = useState(false);
  const [restoringSurveyVersion, setRestoringSurveyVersion] = useState<
    number | null
  >(null);
  const [selectedSurveyVersion, setSelectedSurveyVersion] =
    useState<SurveyVersion | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentAdminAccount | null>(
    null,
  );
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [keyDialogAgent, setKeyDialogAgent] =
    useState<AgentAdminAccount | null>(null);
  const [rotateConfirmAgent, setRotateConfirmAgent] =
    useState<AgentAdminAccount | null>(null);
  const [revealedAgentKey, setRevealedAgentKey] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState({
    ownerUserId: "",
    name: "",
    description: "",
    isActive: true,
    permissions: ["logs.read", "agents.read", "agents.write"] as string[],
  });
  const [deidReviewJobs, setDeidReviewJobs] = useState<DeidReviewJob[]>([]);
  const [deidReviewLoading, setDeidReviewLoading] = useState(true);
  const [deidReviewDetailLoading, setDeidReviewDetailLoading] = useState(false);
  const [selectedDeidReviewId, setSelectedDeidReviewId] = useState<
    string | null
  >(null);
  const [selectedDeidReviewDetail, setSelectedDeidReviewDetail] =
    useState<DeidReviewDetail | null>(null);
  const [deidReviewReloadTick, setDeidReviewReloadTick] = useState(0);
  const [deidReviewAction, setDeidReviewAction] = useState<"create" | "merge">(
    "create",
  );
  const [deidReviewForm, setDeidReviewForm] = useState({
    datasetId: "",
    title: "",
    description: "",
    category: "other",
    accessType: "free" as "free" | "paid",
    price: 0,
    entitlementPolicy: "purchased_only" as
      | "purchased_only"
      | "all_versions_if_any_purchase",
  });
  const [completingDeidReview, setCompletingDeidReview] = useState(false);
  const [deidReviewMessage, setDeidReviewMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/app/me", {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (isMounted) {
          setCurrentUser(payload);
        }
      } catch {
        // ignore
      }
    };

    const loadSurveys = async () => {
      setSurveyLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (surveySearch) params.set("search", surveySearch);
        if (surveyVisibility !== "all")
          params.set("visibility", surveyVisibility);
        if (surveyPublished !== "all") params.set("published", surveyPublished);
        params.set("limit", PAGE_SIZE.toString());
        params.set("offset", "0");

        const response = await fetch(
          `/api/app/admin/surveys?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(getAdminError(payload, "loadError"));
        }
        const payload = await response.json();
        if (isMounted) {
          setSurveys(payload.surveys || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(tAdmin("loadError"));
          setSurveys([]);
        }
      } finally {
        if (isMounted) {
          setSurveyLoading(false);
        }
      }
    };

    loadProfile();
    loadSurveys();
    return () => {
      isMounted = false;
    };
  }, [surveySearch, surveyVisibility, surveyPublished, tAdmin]);

  useEffect(() => {
    let isMounted = true;
    const loadDatasets = async () => {
      setDatasetLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (datasetSearch) params.set("search", datasetSearch);
        if (datasetActive !== "all") params.set("active", datasetActive);
        params.set("limit", PAGE_SIZE.toString());
        params.set("offset", "0");

        const response = await fetch(
          `/api/app/admin/datasets?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(getAdminError(payload, "loadError"));
        }
        const payload = await response.json();
        if (isMounted) {
          setDatasets(payload.datasets || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(tAdmin("loadError"));
          setDatasets([]);
        }
      } finally {
        if (isMounted) {
          setDatasetLoading(false);
        }
      }
    };

    loadDatasets();
    return () => {
      isMounted = false;
    };
  }, [datasetSearch, datasetActive, tAdmin]);

  useEffect(() => {
    let isMounted = true;
    const loadDeidReviews = async () => {
      setDeidReviewLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/app/admin/deid/reviews?limit=50&offset=0", {
          cache: "no-store",
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(getAdminError(payload, "loadError"));
        }
        const payload = await response.json().catch(() => ({}));
        if (!isMounted) return;
        const nextJobs = Array.isArray(payload?.jobs)
          ? (payload.jobs as DeidReviewJob[])
          : [];
        setDeidReviewJobs(nextJobs);
        setSelectedDeidReviewId((previous) => {
          if (previous && nextJobs.some((job) => job.id === previous)) {
            return previous;
          }
          return nextJobs.length > 0 ? nextJobs[0].id : null;
        });
      } catch (err) {
        if (!isMounted) return;
        setDeidReviewJobs([]);
        setSelectedDeidReviewId(null);
        setSelectedDeidReviewDetail(null);
        setError(getErrorMessage(err, "loadError"));
      } finally {
        if (isMounted) {
          setDeidReviewLoading(false);
        }
      }
    };

    void loadDeidReviews();
    return () => {
      isMounted = false;
    };
  }, [deidReviewReloadTick, tAdmin]);

  useEffect(() => {
    let isMounted = true;
    const loadDeidReviewDetail = async () => {
      if (!selectedDeidReviewId) {
        setSelectedDeidReviewDetail(null);
        return;
      }
      setDeidReviewDetailLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/app/admin/deid/reviews/${selectedDeidReviewId}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            getAdminError(payload, "loadError"),
          );
        }
        const payload = (await response.json().catch(() => ({}))) as DeidReviewDetail;
        if (!isMounted) return;
        setSelectedDeidReviewDetail(payload);

        const surveyTitle = String(payload?.job?.survey_title || "").trim();
        setDeidReviewForm((previous) => ({
          ...previous,
          title:
            previous.title.trim().length > 0
              ? previous.title
              : surveyTitle
                ? `${surveyTitle} - De-identified`
                : previous.title,
        }));
      } catch (err) {
        if (!isMounted) return;
        setSelectedDeidReviewDetail(null);
        setError(getErrorMessage(err, "loadError"));
      } finally {
        if (isMounted) {
          setDeidReviewDetailLoading(false);
        }
      }
    };

    void loadDeidReviewDetail();
    return () => {
      isMounted = false;
    };
  }, [selectedDeidReviewId, tAdmin]);

  useEffect(() => {
    let isMounted = true;
    const loadUsers = async () => {
      setUserLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (userSearch) params.set("search", userSearch);
        if (userRoleFilter !== "all") params.set("role", userRoleFilter);
        if (userTierFilter !== "all")
          params.set("membership_tier", userTierFilter);
        if (userDisabledFilter !== "all")
          params.set("is_disabled", userDisabledFilter);
        params.set("limit", PAGE_SIZE.toString());
        params.set("offset", "0");

        const response = await fetch(`/api/app/admin/users?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(getAdminError(payload, "loadError"));
        }
        const payload = await response.json();
        if (isMounted) {
          setUsers(payload.users || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(tAdmin("loadError"));
          setUsers([]);
        }
      } finally {
        if (isMounted) {
          setUserLoading(false);
        }
      }
    };

    loadUsers();
    return () => {
      isMounted = false;
    };
  }, [
    tAdmin,
    userDisabledFilter,
    userReloadTick,
    userRoleFilter,
    userSearch,
    userTierFilter,
  ]);

  useEffect(() => {
    let isMounted = true;
    const loadPointsToolUsers = async () => {
      setPointsToolLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("role", "all");
        if (pointsToolSearch) params.set("search", pointsToolSearch);
        if (pointsToolTierFilter !== "all")
          params.set("membership_tier", pointsToolTierFilter);
        if (pointsToolDisabledFilter !== "all")
          params.set("is_disabled", pointsToolDisabledFilter);
        params.set("limit", "100");
        params.set("offset", "0");

        const response = await fetch(`/api/app/admin/users?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(getAdminError(payload, "loadError"));
        }

        const payload = await response.json().catch(() => ({}));
        if (!isMounted) return;
        setPointsToolUsers(payload.users || []);
      } catch (err) {
        if (!isMounted) return;
        setError(getErrorMessage(err, "loadError"));
        setPointsToolUsers([]);
      } finally {
        if (isMounted) {
          setPointsToolLoading(false);
        }
      }
    };

    void loadPointsToolUsers();
    return () => {
      isMounted = false;
    };
  }, [
    pointsToolDisabledFilter,
    pointsToolReloadTick,
    pointsToolSearch,
    pointsToolTierFilter,
    tAdmin,
  ]);

  useEffect(() => {
    setSelectedPointsUserIds((prev) =>
      prev.filter((userId) => pointsToolUsers.some((user) => user.id === userId)),
    );
  }, [pointsToolUsers]);

  useEffect(() => {
    let isMounted = true;
    const loadAdminUsers = async () => {
      setAdminUserLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (adminSearch) params.set("search", adminSearch);
        params.set("role", "admin");
        params.set("limit", PAGE_SIZE.toString());
        params.set("offset", "0");

        const response = await fetch(`/api/app/admin/users?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(getAdminError(payload, "loadError"));
        }
        const payload = await response.json();
        if (isMounted) {
          setAdminUsers(payload.users || []);
        }
      } catch {
        if (isMounted) {
          setError(tAdmin("loadError"));
          setAdminUsers([]);
        }
      } finally {
        if (isMounted) {
          setAdminUserLoading(false);
        }
      }
    };

    loadAdminUsers();
    return () => {
      isMounted = false;
    };
  }, [adminReloadTick, adminSearch, tAdmin]);

  useEffect(() => {
    if (!addAdminDialogOpen) return;

    let isMounted = true;
    const loadCandidates = async () => {
      setAddAdminCandidatesLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("role", "non_admin");
        params.set("limit", "50");
        params.set("offset", "0");
        if (addAdminSearch.trim()) {
          params.set("search", addAdminSearch.trim());
        }

        const response = await fetch(`/api/app/admin/users?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(getAdminError(payload, "loadError"));
        }

        const payload = await response.json().catch(() => ({}));
        if (!isMounted) return;
        const candidates = payload?.users || [];
        setAddAdminCandidates(candidates);
        if (candidates.length === 0) {
          setSelectedAddAdminUserId("");
          return;
        }
        if (
          candidates.length > 0 &&
          !candidates.some((item: AdminUser) => item.id === selectedAddAdminUserId)
        ) {
          setSelectedAddAdminUserId(candidates[0].id);
        }
      } catch (err) {
        if (!isMounted) return;
        setAddAdminCandidates([]);
        setSelectedAddAdminUserId("");
        setError(getErrorMessage(err, "loadError"));
      } finally {
        if (isMounted) {
          setAddAdminCandidatesLoading(false);
        }
      }
    };

    void loadCandidates();
    return () => {
      isMounted = false;
    };
  }, [addAdminDialogOpen, addAdminSearch, tAdmin]);

  useEffect(() => {
    let isMounted = true;
    const loadAgents = async () => {
      setAgentLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (agentSearch) params.set("search", agentSearch);
        if (currentUser?.isSuperAdmin && agentOwnerFilter !== "all") {
          params.set("owner_user_id", agentOwnerFilter);
        }
        params.set("limit", PAGE_SIZE.toString());
        params.set("offset", "0");

        const response = await fetch(`/api/app/admin/agents?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            resolveUiError(payload, tAdmin("loadError")),
          );
        }
        const payload = await response.json();
        if (isMounted) {
          setAgentAccounts(payload.accounts || []);
        }
      } catch {
        if (isMounted) {
          setError(tAdmin("loadError"));
          setAgentAccounts([]);
        }
      } finally {
        if (isMounted) {
          setAgentLoading(false);
        }
      }
    };

    loadAgents();
    return () => {
      isMounted = false;
    };
  }, [agentOwnerFilter, agentSearch, currentUser?.isSuperAdmin, tAdmin]);

  useEffect(() => {
    setMembershipDrafts((prev) => {
      const next = { ...prev };
      for (const user of users) {
        next[user.id] = next[user.id] || {
          membershipTier: user.membershipTier,
          membershipIsPermanent: user.membershipIsPermanent ?? true,
          membershipPeriodEndAt: user.membershipPeriodEndAt
            ? utcToDateOnly(user.membershipPeriodEndAt, timeZone)
            : "",
        };
      }
      return next;
    });
  }, [timeZone, users]);

  useEffect(() => {
    if (!editingSurvey) return;
    void trackUIEvent({
      screen: "admin_surveys",
      component: "survey_dialog",
      event_name: "open",
      resource_id: editingSurvey.id,
      state_to: "open",
    });
  }, [editingSurvey]);

  useEffect(() => {
    if (!editingDataset) return;
    void trackUIEvent({
      screen: "admin_datasets",
      component: "dataset_dialog",
      event_name: "open",
      resource_id: editingDataset.id,
      state_to: "open",
    });
  }, [editingDataset]);

  useEffect(() => {
    if (!uploadDialogOpen) return;
    void trackUIEvent({
      screen: "admin_datasets",
      component: "upload_dialog",
      event_name: "open",
      state_to: "open",
    });
  }, [uploadDialogOpen]);

  useEffect(() => {
    if (!selectedSurveyVersion) return;
    void trackUIEvent({
      screen: "admin_surveys",
      component: "version_preview_dialog",
      event_name: "open",
      resource_id: selectedSurveyVersion.id,
      state_to: "open",
    });
  }, [selectedSurveyVersion]);

  useEffect(() => {
    let isMounted = true;

    const loadPolicies = async () => {
      setPolicyLoading(true);
      setSystemSettingsLoading(true);
      setError(null);
      const [policiesResult, writersResult, settingsResult] =
        await Promise.allSettled([
          fetch("/api/app/admin/policies", { cache: "no-store" }),
          fetch("/api/app/admin/policy-writers", { cache: "no-store" }),
          fetch("/api/app/admin/system-settings", { cache: "no-store" }),
        ]);

      if (!isMounted) return;

      let hasAnyLoadError = false;

      if (policiesResult.status === "fulfilled" && policiesResult.value.ok) {
        const policiesPayload = await policiesResult.value
          .json()
          .catch(() => ({}));
        setTiers(policiesPayload.tiers || []);
        setCapabilities(policiesPayload.capabilities || []);
        setMatrix(policiesPayload.matrix || []);
      } else {
        hasAnyLoadError = true;
      }

      if (writersResult.status === "fulfilled" && writersResult.value.ok) {
        const writersPayload = await writersResult.value
          .json()
          .catch(() => ({}));
        setPolicyWriters(writersPayload.users || []);
      } else {
        hasAnyLoadError = true;
      }

      if (settingsResult.status === "fulfilled" && settingsResult.value.ok) {
        const settingsPayload = await settingsResult.value
          .json()
          .catch(() => ({}));
        setSurveyBasePointsDraft(
          Number.isFinite(Number(settingsPayload?.surveyBasePoints))
            ? Math.max(0, Math.floor(Number(settingsPayload.surveyBasePoints)))
            : 1,
        );
        setSignupInitialPointsDraft(
          Number.isFinite(Number(settingsPayload?.signupInitialPoints))
            ? Math.max(
              0,
              Math.floor(Number(settingsPayload.signupInitialPoints)),
            )
            : 0,
        );
      } else {
        hasAnyLoadError = true;
      }

      if (hasAnyLoadError) {
        setError(tAdmin("loadError"));
      }

      setPolicyLoading(false);
      setSystemSettingsLoading(false);
    };

    loadPolicies();
    return () => {
      isMounted = false;
    };
  }, [tAdmin]);

  useEffect(() => {
    setPlanRetirementDrafts((prev) => {
      const next = { ...prev };
      for (const tier of tiers) {
        if (next[tier.id]) continue;
        const freeFallback = tiers.find(
          (candidate) =>
            candidate.id !== tier.id &&
            candidate.isActive !== false &&
            candidate.code === "free",
        );
        const fallback = freeFallback || tiers.find(
          (candidate) =>
            candidate.id !== tier.id && candidate.isActive !== false,
        );
        next[tier.id] = {
          replacementTierCode: tier.replacementTierCode || fallback?.code || "",
          executionTiming: "immediate",
        };
      }
      return next;
    });
  }, [tiers]);

  const membershipTierOptions = useMemo(() => {
    if (tiers.length > 0) return tiers;

    const fromUsers = users
      .map((user) => user.membershipTier)
      .filter((tierCode): tierCode is string => Boolean(tierCode));
    const defaults = ["free", "pro"];
    const unique = Array.from(new Set([...defaults, ...fromUsers]));

    return unique.map((code) => ({
      id: `fallback-${code}`,
      code,
      name: code,
      isActive: true,
    })) as MembershipTier[];
  }, [tiers, users]);
  const activeTiers = useMemo(
    () => tiers.filter((tier) => tier.isActive !== false),
    [tiers],
  );
  const inactiveTiers = useMemo(
    () => tiers.filter((tier) => tier.isActive === false),
    [tiers],
  );

  const applySurveyToEditor = (survey: Survey) => {
    setEditingSurvey(survey);
    setSurveyForm({
      title: survey.title,
      description: survey.description || "",
      visibility: survey.visibility,
      includeInDatasets: survey.includeInDatasets,
      isResponseOpen: survey.isResponseOpen,
      pointsReward: survey.pointsReward,
    });
  };

  const loadSurveyVersions = async (surveyId: string) => {
    setSurveyVersionsLoading(true);
    try {
      const response = await fetch(`/api/app/admin/surveys/${surveyId}/versions`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "loadError"));
      }
      const payload = await response.json();
      setSurveyVersions(payload.versions || []);
    } catch {
      setSurveyVersions([]);
      setError(tAdmin("loadError"));
    } finally {
      setSurveyVersionsLoading(false);
    }
  };

  const openSurveyEditor = (survey: Survey) => {
    applySurveyToEditor(survey);
    setSurveyVersions([]);
    setSelectedSurveyVersion(null);
    void loadSurveyVersions(survey.id);
  };

  const loadDatasetVersions = async (datasetId: string) => {
    setDatasetVersionsLoading(true);
    try {
      const response = await fetch(
        `/api/app/admin/datasets/${datasetId}/versions`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "loadError"));
      }
      const payload = await response.json().catch(() => ({}));
      setDatasetVersions(payload?.versions || []);
    } catch {
      setDatasetVersions([]);
      setError(tAdmin("loadError"));
    } finally {
      setDatasetVersionsLoading(false);
    }
  };

  const openDatasetEditor = (dataset: Dataset) => {
    setEditingDataset(dataset);
    setDatasetVersions([]);
    setDatasetVersionUploadFile(null);
    if (datasetVersionFileInputRef.current) {
      datasetVersionFileInputRef.current.value = "";
    }
    setDatasetForm({
      title: dataset.title,
      description: dataset.description || "",
      category: dataset.category,
      accessType: dataset.accessType,
      price: dataset.price,
      sampleSize: dataset.sampleSize,
      isActive: dataset.isActive,
      entitlementPolicy: dataset.entitlementPolicy || "purchased_only",
    });
    void loadDatasetVersions(dataset.id);
  };

  const saveSurvey = async () => {
    if (!editingSurvey) return;
    setSavingSurvey(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/app/admin/surveys/${editingSurvey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: surveyForm.title,
          description: surveyForm.description,
          visibility: surveyForm.visibility,
          includeInDatasets: surveyForm.includeInDatasets,
          pointsReward: surveyForm.pointsReward,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      const payload = await response.json();
      setSurveys((prev) =>
        prev.map((survey) => (survey.id === payload.id ? payload : survey)),
      );
      applySurveyToEditor(payload);
    } catch (err) {
      setError(tAdmin("updateError"));
    } finally {
      setSavingSurvey(false);
    }
  };

  const publishSurveyVersion = async () => {
    if (!editingSurvey) return;
    setPublishingSurveyVersion(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(
        `/api/app/admin/surveys/${editingSurvey.id}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visibility: surveyForm.visibility,
            includeInDatasets: surveyForm.includeInDatasets,
            pointsReward: surveyForm.pointsReward,
          }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      const payload = await response.json().catch(() => ({}));
      const nextSurvey = (payload?.survey || payload) as Survey | null;
      if (!nextSurvey?.id) {
        throw new Error(tAdmin("updateError"));
      }
      setSurveys((prev) =>
        prev.map((survey) => (survey.id === nextSurvey.id ? nextSurvey : survey)),
      );
      applySurveyToEditor(nextSurvey);
      await loadSurveyVersions(nextSurvey.id);
      setStatusMessage(typeof payload?.message === "string" ? payload.message : null);
      notifyPointsBalanceChanged();
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setPublishingSurveyVersion(false);
    }
  };

  const toggleSurveyResponses = async (open: boolean) => {
    if (!editingSurvey) return;
    setTogglingSurveyResponses(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/app/admin/surveys/${editingSurvey.id}/responses/${open ? "open" : "close"}`,
        { method: "POST" },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      const payload = await response.json();
      setSurveys((prev) =>
        prev.map((survey) => (survey.id === payload.id ? payload : survey)),
      );
      applySurveyToEditor(payload);
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setTogglingSurveyResponses(false);
    }
  };

  const restoreSurveyDraft = async (versionNumber: number) => {
    if (!editingSurvey) return;
    setRestoringSurveyVersion(versionNumber);
    setError(null);
    try {
      const response = await fetch(
        `/api/app/admin/surveys/${editingSurvey.id}/versions/${versionNumber}/restore-draft`,
        { method: "POST" },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      const payload = await response.json();
      setSurveys((prev) =>
        prev.map((survey) => (survey.id === payload.id ? payload : survey)),
      );
      applySurveyToEditor(payload);
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setRestoringSurveyVersion(null);
    }
  };

  const saveDataset = async () => {
    if (!editingDataset) return;
    setSavingDataset(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/app/admin/datasets/${editingDataset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: datasetForm.title,
          description: datasetForm.description,
          category: datasetForm.category,
          accessType: datasetForm.accessType,
          price: datasetForm.price,
          sampleSize: datasetForm.sampleSize,
          isActive: datasetForm.isActive,
          entitlementPolicy: datasetForm.entitlementPolicy,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      const payload = await response.json();
      setDatasets((prev) =>
        prev.map((dataset) => (dataset.id === payload.id ? payload : dataset)),
      );
      setEditingDataset(null);
    } catch (err) {
      setError(tAdmin("updateError"));
    } finally {
      setSavingDataset(false);
    }
  };

  const publishDatasetVersion = async () => {
    if (!editingDataset) return;
    setPublishingDatasetVersion(true);
    setError(null);
    setStatusMessage(null);
    try {
      const priceForPublish =
        datasetForm.accessType === "paid" ? datasetForm.price : 0;
      const requestInit: RequestInit = datasetVersionUploadFile
        ? (() => {
            const formData = new FormData();
            formData.append("file", datasetVersionUploadFile);
            formData.append("accessType", datasetForm.accessType);
            formData.append("price", String(priceForPublish));
            return {
              method: "POST",
              body: formData,
            };
          })()
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessType: datasetForm.accessType,
              price: priceForPublish,
            }),
          };
      const response = await fetch(
        `/api/app/admin/datasets/${editingDataset.id}/publish`,
        requestInit,
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      const payload = await response.json().catch(() => ({}));
      const nextDataset = (payload?.dataset || null) as Dataset | null;
      if (nextDataset) {
        setDatasets((prev) =>
          prev.map((item) => (item.id === nextDataset.id ? nextDataset : item)),
        );
        setEditingDataset(nextDataset);
      }
      setDatasetVersionUploadFile(null);
      if (datasetVersionFileInputRef.current) {
        datasetVersionFileInputRef.current.value = "";
      }
      setStatusMessage(typeof payload?.message === "string" ? payload.message : null);
      await loadDatasetVersions(editingDataset.id);
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setPublishingDatasetVersion(false);
    }
  };

  const uploadDataset = async () => {
    if (!uploadFile) {
      setError(tAdmin("datasetFileRequired"));
      return;
    }
    setUploadingDataset(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("surveyId", uploadForm.surveyId);
      formData.append("title", uploadForm.title);
      formData.append("description", uploadForm.description);
      formData.append("category", uploadForm.category);
      formData.append("accessType", uploadForm.accessType);
      formData.append("price", String(uploadForm.price));
      formData.append("sampleSize", String(uploadForm.sampleSize));
      formData.append("file", uploadFile);

      const response = await fetch("/api/app/admin/datasets", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "uploadError"));
      }
      const payload = await response.json();
      setDatasets((prev) => [payload, ...prev]);
      setUploadDialogOpen(false);
      setUploadForm({
        surveyId: "",
        title: "",
        description: "",
        category: "other",
        accessType: "free",
        price: 0,
        sampleSize: 0,
      });
      setUploadFile(null);
    } catch (err) {
      setError(tAdmin("uploadError"));
    } finally {
      setUploadingDataset(false);
    }
  };

  const deleteSurvey = async (survey: Survey) => {
    if (!window.confirm(tAdmin("deleteSurveyConfirm"))) return;
    try {
      const response = await fetch(`/api/app/admin/surveys/${survey.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "deleteError"));
      }
      setSurveys((prev) => prev.filter((item) => item.id !== survey.id));
    } catch (err) {
      setError(tAdmin("deleteError"));
    }
  };

  const deleteDataset = async (dataset: Dataset) => {
    if (!window.confirm(tAdmin("deleteDatasetConfirm"))) return;
    try {
      const response = await fetch(`/api/app/admin/datasets/${dataset.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "deleteError"));
      }
      setDatasets((prev) => prev.filter((item) => item.id !== dataset.id));
    } catch (err) {
      setError(tAdmin("deleteError"));
    }
  };

  const completeDeidReview = async () => {
    if (!selectedDeidReviewId) return;

    if (deidReviewAction === "merge" && !deidReviewForm.datasetId.trim()) {
      setError(tAdmin("deidDatasetIdRequired"));
      return;
    }

    setCompletingDeidReview(true);
    setError(null);
    setDeidReviewMessage(null);
    try {
      const body: Record<string, unknown> = {
        action: deidReviewAction,
      };
      if (deidReviewAction === "merge") {
        body.datasetId = deidReviewForm.datasetId.trim();
      } else {
        body.title = deidReviewForm.title.trim();
        body.description = deidReviewForm.description.trim() || undefined;
        body.category = deidReviewForm.category.trim() || "other";
        body.accessType = deidReviewForm.accessType;
        body.price = deidReviewForm.accessType === "paid" ? deidReviewForm.price : 0;
        body.entitlementPolicy = deidReviewForm.entitlementPolicy;
      }

      const response = await fetch(
        `/api/app/admin/deid/reviews/${selectedDeidReviewId}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      const payload = await response.json().catch(() => ({}));
      setDeidReviewMessage(
        tAdmin("deidReviewCompleteMessage", {
          datasetId: String(
            payload?.dataset_id || payload?.datasetId || payload?.DatasetID || "",
          ),
        }),
      );
      setSelectedDeidReviewDetail(null);
      setSelectedDeidReviewId(null);
      setDeidReviewReloadTick((previous) => previous + 1);
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setCompletingDeidReview(false);
    }
  };

  const resetAgentForm = (account?: AgentAdminAccount | null) => {
    setAgentForm({
      ownerUserId: account?.owner_user_id || currentUser?.id || "",
      name: account?.name || "",
      description: account?.description || "",
      isActive: account?.is_active ?? true,
      permissions: account?.permissions?.length
        ? account.permissions
        : ["logs.read", "agents.read", "agents.write"],
    });
  };

  const openAgentDialog = (account?: AgentAdminAccount) => {
    setEditingAgent(account || null);
    resetAgentForm(account || null);
    setAgentDialogOpen(true);
    void trackUIEvent({
      screen: "admin_agents",
      component: "agent_dialog",
      event_name: "open",
      resource_id: account?.id,
      state_to: "open",
    });
  };

  const closeAgentDialog = () => {
    setAgentDialogOpen(false);
    setEditingAgent(null);
    void trackUIEvent({
      screen: "admin_agents",
      component: "agent_dialog",
      event_name: "close",
      resource_id: editingAgent?.id,
      state_to: "closed",
    });
  };

  const saveAgentAccount = async () => {
    setSavingAgentId(editingAgent?.id || "new");
    setError(null);
    try {
      const payload = {
        owner_user_id: currentUser?.isSuperAdmin
          ? agentForm.ownerUserId || undefined
          : undefined,
        name: agentForm.name,
        description: agentForm.description || undefined,
        is_active: agentForm.isActive,
        permissions: agentForm.permissions,
      };
      const response = await fetch(
        editingAgent
          ? `/api/app/admin/agents/${editingAgent.id}`
          : "/api/app/admin/agents",
        {
          method: editingAgent ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(resolveUiError(body, tAdmin("updateError")));
      }

      if (editingAgent) {
        setAgentAccounts((prev) =>
          prev.map((item) => (item.id === editingAgent.id ? body : item)),
        );
      } else {
        const createdAccount = body.account || body;
        setAgentAccounts((prev) => [createdAccount, ...prev]);
        if (body.api_key) {
          setKeyDialogAgent(createdAccount);
          setRevealedAgentKey(body.api_key);
        }
      }
      void trackUIEvent({
        screen: "admin_agents",
        component: "agent_dialog",
        event_name: editingAgent ? "update_submit" : "create_submit",
        resource_id: editingAgent?.id || body?.account?.id,
      });
      closeAgentDialog();
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setSavingAgentId(null);
    }
  };

  const revealAgentKey = async (account: AgentAdminAccount) => {
    setSavingAgentId(account.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/app/admin/agents/${account.id}/reveal-key`,
        { method: "POST" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(resolveUiError(body, tAdmin("updateError")));
      }
      setRotateConfirmAgent(null);
      setKeyDialogAgent(account);
      setRevealedAgentKey(body.api_key || null);
      void trackUIEvent({
        screen: "admin_agents",
        component: "agent_key",
        event_name: "reveal",
        resource_id: account.id,
      });
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setSavingAgentId(null);
    }
  };

  const openRotateAgentKeyDialog = (account: AgentAdminAccount) => {
    setRotateConfirmAgent(account);
    void trackUIEvent({
      screen: "admin_agents",
      component: "rotate_agent_key_dialog",
      event_name: "open",
      resource_id: account.id,
      state_to: "open",
    });
  };

  const closeRotateAgentKeyDialog = () => {
    void trackUIEvent({
      screen: "admin_agents",
      component: "rotate_agent_key_dialog",
      event_name: "close",
      resource_id: rotateConfirmAgent?.id,
      state_to: "closed",
    });
    setRotateConfirmAgent(null);
  };

  const rotateAgentKey = async (account: AgentAdminAccount) => {
    setSavingAgentId(account.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/app/admin/agents/${account.id}/rotate-key`,
        { method: "POST" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(resolveUiError(body, tAdmin("updateError")));
      }
      setAgentAccounts((prev) =>
        prev.map((item) =>
          item.id === account.id
            ? { ...item, key_prefix: body.key_prefix || item.key_prefix }
            : item,
        ),
      );
      setRotateConfirmAgent(null);
      setKeyDialogAgent(account);
      setRevealedAgentKey(body.api_key || null);
      void trackUIEvent({
        screen: "admin_agents",
        component: "agent_key",
        event_name: "rotate",
        resource_id: account.id,
      });
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setSavingAgentId(null);
    }
  };

  const toggleAgentPermission = (permission: string, checked: boolean) => {
    setAgentForm((prev) => ({
      ...prev,
      permissions: checked
        ? Array.from(new Set([...prev.permissions, permission]))
        : prev.permissions.filter((item) => item !== permission),
    }));
  };

  const toggleAdmin = async (user: AdminUser, nextValue: boolean) => {
    if (!currentUser?.isSuperAdmin) return;
    setSavingUserId(user.id);
    setError(null);
    try {
      const response = await fetch(`/api/app/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: nextValue }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      setUserReloadTick((value) => value + 1);
      setAdminReloadTick((value) => value + 1);
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setSavingUserId(null);
    }
  };

  const toggleUserDisabled = async (user: AdminUser, nextValue: boolean) => {
    if (!currentUser?.isSuperAdmin) return;
    setSavingUserId(user.id);
    setError(null);
    try {
      const response = await fetch(`/api/app/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDisabled: nextValue }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      setUserReloadTick((value) => value + 1);
      setAdminReloadTick((value) => value + 1);
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setSavingUserId(null);
    }
  };

  const patchMembershipDraft = (
    userId: string,
    patch: Partial<{
      membershipTier: string;
      membershipIsPermanent: boolean;
      membershipPeriodEndAt: string;
    }>,
  ) => {
    setMembershipDrafts((prev) => {
      const current = prev[userId] || {
        membershipTier: "free",
        membershipIsPermanent: true,
        membershipPeriodEndAt: "",
      };
      return {
        ...prev,
        [userId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const saveMembershipGrant = async (user: AdminUser) => {
    const draft = membershipDrafts[user.id];
    if (!draft) return;
    setSavingUserId(user.id);
    setError(null);
    try {
      const response = await fetch(`/api/app/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipTier: draft.membershipTier,
          membershipIsPermanent: draft.membershipIsPermanent,
          membershipPeriodEndAt: draft.membershipIsPermanent
            ? ""
            : draft.membershipPeriodEndAt,
          timeZone,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      setUserReloadTick((value) => value + 1);
      setAdminReloadTick((value) => value + 1);
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setSavingUserId(null);
    }
  };

  const togglePointsUserSelection = (userId: string, checked: boolean) => {
    setSelectedPointsUserIds((prev) => {
      if (checked) {
        if (prev.includes(userId)) return prev;
        return [...prev, userId];
      }
      return prev.filter((id) => id !== userId);
    });
  };

  const executePointsAdjustment = async (
    request: PendingPointsAdjustRequest,
    underflowStrategy?: PointsUnderflowStrategy,
  ) => {
    const response = await fetch("/api/app/admin/users/points-adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...request,
        ...(underflowStrategy ? { underflowStrategy } : {}),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (response.status === 409) {
      setPendingPointsAdjustRequest(request);
      setInsufficientUsers(
        Array.isArray(payload?.insufficientUsers) ? payload.insufficientUsers : [],
      );
      setInsufficientDialogOpen(true);
      return false;
    }
    if (!response.ok) {
      throw new Error(getAdminError(payload, "updateError"));
    }
    return true;
  };

  const submitPointsAdjustment = async () => {
    const delta = Math.trunc(Number(pointsDeltaDraft));
    const reason = pointsReasonDraft.trim();
    if (selectedPointsUserIds.length === 0) {
      setError(tAdmin("pointsAdjustSelectUserError"));
      return;
    }
    if (!Number.isFinite(delta) || delta === 0) {
      setError(tAdmin("pointsAdjustDeltaInvalidError"));
      return;
    }
    if (!reason) {
      setError(tAdmin("pointsAdjustReasonRequiredError"));
      return;
    }

    setApplyingPointsAdjust(true);
    setError(null);
    try {
      const succeeded = await executePointsAdjustment({
        userIds: selectedPointsUserIds,
        delta,
        reason,
      });
      if (!succeeded) return;

      setPointsReasonDraft("");
      setPointsToolReloadTick((value) => value + 1);
      setUserReloadTick((value) => value + 1);
      notifyPointsBalanceChanged();
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setApplyingPointsAdjust(false);
    }
  };

  const applyPointsAdjustmentStrategy = async (
    strategy: PointsUnderflowStrategy,
  ) => {
    const pending = pendingPointsAdjustRequest;
    if (!pending) return;
    if (strategy === "reject_all") {
      setInsufficientDialogOpen(false);
      setPendingPointsAdjustRequest(null);
      return;
    }

    setApplyingPointsAdjust(true);
    setError(null);
    try {
      const succeeded = await executePointsAdjustment(pending, strategy);
      if (!succeeded) return;

      setInsufficientDialogOpen(false);
      setPendingPointsAdjustRequest(null);
      setInsufficientUsers([]);
      setPointsReasonDraft("");
      setPointsToolReloadTick((value) => value + 1);
      setUserReloadTick((value) => value + 1);
      notifyPointsBalanceChanged();
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setApplyingPointsAdjust(false);
    }
  };

  const promoteSelectedUserToAdmin = async () => {
    if (!currentUser?.isSuperAdmin || !selectedAddAdminUserId) return;

    setAddingAdmin(true);
    setError(null);
    try {
      const response = await fetch(`/api/app/admin/users/${selectedAddAdminUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: true }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }

      setAddAdminDialogOpen(false);
      setAddAdminSearch("");
      setAddAdminCandidates([]);
      setSelectedAddAdminUserId("");
      setUserReloadTick((value) => value + 1);
      setAdminReloadTick((value) => value + 1);
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setAddingAdmin(false);
    }
  };

  const policyMatrixValue = (tierCode: string, capabilityKey: string) =>
    matrix.find(
      (entry) =>
        entry.tierCode === tierCode && entry.capabilityKey === capabilityKey,
    )?.isAllowed ?? false;

  const updatePolicyMatrixValue = (
    tierCode: string,
    capabilityKey: string,
    isAllowed: boolean,
  ) => {
    setMatrix((prev) => {
      const index = prev.findIndex(
        (entry) =>
          entry.tierCode === tierCode && entry.capabilityKey === capabilityKey,
      );
      if (index === -1) {
        return [...prev, { tierCode, capabilityKey, isAllowed }];
      }
      const next = [...prev];
      next[index] = { ...next[index], isAllowed };
      return next;
    });
  };

  const savePolicies = async () => {
    setPolicySaving(true);
    setError(null);
    try {
      const response = await fetch("/api/app/admin/policies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: matrix }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
    } catch {
      setError(tAdmin("updateError"));
    } finally {
      setPolicySaving(false);
    }
  };

  const savePlan = async (plan: MembershipTier) => {
    setSavingPlanId(plan.id);
    setError(null);
    try {
      const response = await fetch(`/api/app/admin/subscription-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameI18n: plan.nameI18n,
          descriptionI18n: plan.descriptionI18n,
          isPurchasable: plan.isPurchasable,
          showOnPricing: plan.showOnPricing,
          priceCentsUsd: plan.priceCentsUsd,
          billingInterval: plan.billingInterval || "month",
          allowRenewalForExisting: plan.allowRenewalForExisting,
          monthlyPointsGrant: plan.monthlyPointsGrant ?? 0,
          maxActiveSurveys: plan.maxActiveSurveys ?? null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      const payload = await response.json();
      setTiers((prev) =>
        prev.map((item) => (item.id === plan.id ? payload : item)),
      );
    } catch {
      setError(tAdmin("updateError"));
    } finally {
      setSavingPlanId(null);
    }
  };

  const clearNewPlanFieldError = (key: string) => {
    setNewPlanFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const createPlan = async () => {
    const normalizedCode = newPlan.code.trim().toLowerCase();
    const normalizedNameI18n = {
      "zh-TW": newPlan.nameI18n["zh-TW"]?.trim() || "",
      en: newPlan.nameI18n.en?.trim() || "",
      ja: newPlan.nameI18n.ja?.trim() || "",
    };
    const normalizedDescriptionI18n = {
      "zh-TW": newPlan.descriptionI18n["zh-TW"]?.trim() || "",
      en: newPlan.descriptionI18n.en?.trim() || "",
      ja: newPlan.descriptionI18n.ja?.trim() || "",
    };
    const normalizedPrice = Number(newPlan.priceCentsUsd);
    const normalizedMonthlyPoints = Number(newPlan.monthlyPointsGrant);
    const normalizedMaxActiveSurveys =
      newPlan.maxActiveSurveys == null
        ? null
        : Math.max(0, Math.floor(Number(newPlan.maxActiveSurveys) || 0));

    const nextFieldErrors: Record<string, string> = {};
    if (!normalizedCode) nextFieldErrors.code = tAdmin("planCodeRequired");
    if (!normalizedNameI18n["zh-TW"])
      nextFieldErrors.nameZhTW = tAdmin("planNameZhTWRequired");
    if (!normalizedNameI18n.en) nextFieldErrors.nameEn = tAdmin("planNameEnRequired");
    if (!normalizedNameI18n.ja) nextFieldErrors.nameJa = tAdmin("planNameJaRequired");
    if (!normalizedDescriptionI18n["zh-TW"])
      nextFieldErrors.descriptionZhTW = tAdmin("planDescriptionZhTWRequired");
    if (!normalizedDescriptionI18n.en)
      nextFieldErrors.descriptionEn = tAdmin("planDescriptionEnRequired");
    if (!normalizedDescriptionI18n.ja)
      nextFieldErrors.descriptionJa = tAdmin("planDescriptionJaRequired");
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0)
      nextFieldErrors.priceCentsUsd = tAdmin("planPriceNonNegative");
    if (!Number.isFinite(normalizedMonthlyPoints) || normalizedMonthlyPoints < 0)
      nextFieldErrors.monthlyPointsGrant =
        tAdmin("planMonthlyPointsNonNegative");

    if (Object.keys(nextFieldErrors).length > 0) {
      setNewPlanFieldErrors(nextFieldErrors);
      return;
    }

    setCreatingPlan(true);
    setError(null);
    setNewPlanFieldErrors({});
    try {
      const response = await fetch("/api/app/admin/subscription-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPlan,
          code: normalizedCode,
          nameI18n: normalizedNameI18n,
          descriptionI18n: normalizedDescriptionI18n,
          priceCentsUsd: Math.floor(normalizedPrice),
          monthlyPointsGrant: Math.floor(normalizedMonthlyPoints),
          maxActiveSurveys: normalizedMaxActiveSurveys,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(resolveUiError(payload, tAdmin("createError")));
      }
      const payload = await response.json();
      setTiers((prev) => [...prev, payload]);
      setNewPlan({
        code: "",
        nameI18n: { "zh-TW": "", en: "", ja: "" },
        descriptionI18n: { "zh-TW": "", en: "", ja: "" },
        isPurchasable: false,
        showOnPricing: false,
        priceCentsUsd: 0,
        billingInterval: "month",
        allowRenewalForExisting: false,
        monthlyPointsGrant: 0,
        maxActiveSurveys: null,
      });
    } catch (err) {
      setError(getErrorMessage(err, "updateError"));
    } finally {
      setCreatingPlan(false);
    }
  };

  const saveSystemSettings = async () => {
    setSavingSystemSettings(true);
    setError(null);
    try {
      const surveyBasePoints = Math.max(
        0,
        Math.floor(Number(surveyBasePointsDraft) || 0),
      );
      const signupInitialPoints = Math.max(
        0,
        Math.floor(Number(signupInitialPointsDraft) || 0),
      );
      const response = await fetch("/api/app/admin/system-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyBasePoints, signupInitialPoints }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      const payload = await response.json().catch(() => ({}));
      if (Number.isFinite(Number(payload?.surveyBasePoints))) {
        setSurveyBasePointsDraft(
          Math.max(0, Math.floor(Number(payload.surveyBasePoints))),
        );
      } else {
        setSurveyBasePointsDraft(surveyBasePoints);
      }
      if (Number.isFinite(Number(payload?.signupInitialPoints))) {
        setSignupInitialPointsDraft(
          Math.max(0, Math.floor(Number(payload.signupInitialPoints))),
        );
      } else {
        setSignupInitialPointsDraft(signupInitialPoints);
      }
    } catch {
      setError(tAdmin("updateError"));
    } finally {
      setSavingSystemSettings(false);
    }
  };

  const patchPlanRetirementDraft = (
    planId: string,
    patch: Partial<{
      replacementTierCode: string;
      executionTiming: "immediate" | "on_expiry";
    }>,
  ) => {
    setPlanRetirementDrafts((prev) => {
      const current = prev[planId] || {
        replacementTierCode: "",
        executionTiming: "immediate" as const,
      };
      return {
        ...prev,
        [planId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const deactivatePlan = async (plan: MembershipTier) => {
    const draft = planRetirementDrafts[plan.id];
    if (!draft?.replacementTierCode) {
      setError(tAdmin("replacementPlanRequiredError"));
      return;
    }

    if (
      !window.confirm(
        tAdmin("deactivatePlanConfirm", { plan: plan.code, replacement: draft.replacementTierCode }),
      )
    ) {
      return;
    }

    setDeactivatingPlanId(plan.id);
    setError(null);
    try {
      const response = await fetch(`/api/app/admin/subscription-plans/${plan.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replacementTierCode: draft.replacementTierCode,
          executionTiming: draft.executionTiming,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      const payload = await response.json();
      if (payload?.plan?.id) {
        setTiers((prev) =>
          prev.map((item) =>
            item.id === payload.plan.id ? payload.plan : item,
          ),
        );
      }
    } catch {
      setError(tAdmin("updateError"));
    } finally {
      setDeactivatingPlanId(null);
    }
  };

  const saveCapability = async (capability: Capability) => {
    setSavingCapabilityId(capability.id);
    setError(null);
    try {
      const response = await fetch(`/api/app/admin/capabilities/${capability.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameI18n: capability.nameI18n,
          descriptionI18n: capability.descriptionI18n,
          showOnPricing: capability.showOnPricing,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      const payload = await response.json();
      setCapabilities((prev) =>
        prev.map((item) => (item.id === capability.id ? payload : item)),
      );
    } catch {
      setError(tAdmin("updateError"));
    } finally {
      setSavingCapabilityId(null);
    }
  };

  const setPolicyWriter = async (userId: string, enabled: boolean) => {
    setSavingPolicyWriterId(userId);
    setError(null);
    try {
      const response = await fetch(`/api/app/admin/policy-writers/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(getAdminError(payload, "updateError"));
      }
      setPolicyWriters((prev) =>
        prev.map((item) =>
          item.id === userId
            ? { ...item, canWritePolicy: enabled || item.isSuperAdmin }
            : item,
        ),
      );
    } catch {
      setError(tAdmin("updateError"));
    } finally {
      setSavingPolicyWriterId(null);
    }
  };

  const surveyCountLabel = useMemo(
    () => tAdmin("surveyCount", { count: surveys.length }),
    [surveys.length, tAdmin],
  );
  const datasetCountLabel = useMemo(
    () => tAdmin("datasetCount", { count: datasets.length }),
    [datasets.length, tAdmin],
  );
  const agentCountLabel = useMemo(
    () => tAdmin("agentCount", { count: agentAccounts.length }),
    [agentAccounts.length, tAdmin],
  );
  const userCountLabel = useMemo(
    () => tAdmin("adminCount", { count: users.length }),
    [users.length, tAdmin],
  );
  const adminCountLabel = useMemo(
    () => tAdmin("adminCount", { count: adminUsers.length }),
    [adminUsers.length, tAdmin],
  );
  const policyWriterCountLabel = useMemo(
    () => tAdmin("policyWriterCount", { count: policyWriters.length }),
    [policyWriters.length, tAdmin],
  );
  const deidReviewCountLabel = useMemo(
    () => tAdmin("deidReviewCount", { count: deidReviewJobs.length }),
    [deidReviewJobs.length, tAdmin],
  );
  const selectedDeidJob = useMemo(
    () => deidReviewJobs.find((job) => job.id === selectedDeidReviewId) || null,
    [deidReviewJobs, selectedDeidReviewId],
  );
  const selectedDeidMaskedCount = useMemo(() => {
    if (!selectedDeidJob?.summary_json) return 0;
    const rawValue = selectedDeidJob.summary_json["masked_cells"];
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      return rawValue;
    }
    return 0;
  }, [selectedDeidJob]);
  const canWritePolicies = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.isSuperAdmin) return true;
    return policyWriters.some(
      (writer) => writer.id === currentUser.id && writer.canWritePolicy,
    );
  }, [currentUser, policyWriters]);
  const availableAgentOwners = useMemo(() => {
    const ownerMap = new Map<string, { id: string; label: string }>();

    for (const user of adminUsers) {
      if (!user.isAdmin && !user.isSuperAdmin) continue;
      const primaryLabel = user.displayName || user.email || user.id;
      ownerMap.set(user.id, {
        id: user.id,
        label: `${primaryLabel} (${user.id.slice(0, 8)})`,
      });
    }

    if (currentUser && (currentUser.isAdmin || currentUser.isSuperAdmin)) {
      const primaryLabel =
        currentUser.displayName || currentUser.email || currentUser.id;
      ownerMap.set(currentUser.id, {
        id: currentUser.id,
        label: `${primaryLabel} (${currentUser.id.slice(0, 8)})`,
      });
    }

    return Array.from(ownerMap.values()).sort((left, right) => {
      if (
        currentUser?.id &&
        left.id === currentUser.id &&
        right.id !== currentUser.id
      )
        return -1;
      if (
        currentUser?.id &&
        right.id === currentUser.id &&
        left.id !== currentUser.id
      )
        return 1;
      return left.label.localeCompare(right.label);
    });
  }, [adminUsers, currentUser]);
  const availableAgentOwnerOptions = useMemo(() => {
    if (currentUser?.isSuperAdmin) {
      return [
        { id: "all", label: tAdmin("agentOwnerAll") },
        ...availableAgentOwners,
      ];
    }
    return availableAgentOwners;
  }, [availableAgentOwners, currentUser?.isSuperAdmin, tAdmin]);
  const ownerLabelLookup = useMemo(() => {
    const labels = new Map<string, string>();
    for (const owner of availableAgentOwners) {
      labels.set(owner.id, owner.label);
    }
    return labels;
  }, [availableAgentOwners]);
  const getAgentOwnerLabel = (account: AgentAdminAccount) => {
    const primaryLabel =
      account.owner_display_name ||
      account.owner_email ||
      ownerLabelLookup.get(account.owner_user_id) ||
      account.owner_user_id;
    if (
      account.owner_email &&
      account.owner_display_name &&
      account.owner_email !== account.owner_display_name
    ) {
      return `${account.owner_display_name} (${account.owner_email})`;
    }
    if (primaryLabel === account.owner_user_id) {
      return account.owner_user_id.slice(0, 8);
    }
    return primaryLabel;
  };
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      <div className="container px-4 py-10 md:px-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {tAdmin("title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {tAdmin("description")}
          </p>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {statusMessage && !error ? (
          <div className="text-sm text-emerald-700 dark:text-emerald-300">{statusMessage}</div>
        ) : null}

        <Tabs defaultValue="surveys">
          <TabsList>
            <TabsTrigger value="surveys">{tAdmin("surveysTab")}</TabsTrigger>
            <TabsTrigger value="datasets">{tAdmin("datasetsTab")}</TabsTrigger>
            <TabsTrigger value="deid">{tAdmin("deidReviewsTab")}</TabsTrigger>
            <TabsTrigger value="agents">{tAdmin("agentsTab")}</TabsTrigger>
            <TabsTrigger value="users">{tAdmin("usersTab")}</TabsTrigger>
            <TabsTrigger value="admins">{tAdmin("adminsTab")}</TabsTrigger>
            <TabsTrigger value="policies">{tAdmin("policiesTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="surveys" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{tAdmin("surveysTitle")}</CardTitle>
                <CardDescription>{surveyCountLabel}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <Input
                    placeholder={tAdmin("searchSurveys")}
                    value={surveySearch}
                    onChange={(event) => setSurveySearch(event.target.value)}
                    className="md:max-w-sm"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900"
                      value={surveyVisibility}
                      onChange={(event) =>
                        setSurveyVisibility(event.target.value)
                      }
                    >
                      <option value="all">{tAdmin("visibilityAll")}</option>
                      <option value="public">
                        {tAdmin("visibilityPublic")}
                      </option>
                      <option value="non-public">
                        {tAdmin("visibilityNonPublic")}
                      </option>
                    </select>
                    <select
                      className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900"
                      value={surveyPublished}
                      onChange={(event) =>
                        setSurveyPublished(event.target.value)
                      }
                    >
                      <option value="all">{tAdmin("publishedAll")}</option>
                      <option value="true">{tAdmin("publishedOnly")}</option>
                      <option value="false">{tAdmin("draftOnly")}</option>
                    </select>
                  </div>
                </div>

                {surveyLoading ? (
                  <div className="text-sm text-gray-500">
                    {tCommon("loading")}
                  </div>
                ) : surveys.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    {tAdmin("noSurveys")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {surveys.map((survey) => (
                      <div
                        key={survey.id}
                        className="flex flex-col gap-3 border border-gray-100 dark:border-gray-800 rounded-lg p-4 bg-white/70 dark:bg-gray-900/70"
                      >
                        {(() => {
                          const visibilityLabel =
                            survey.visibility === "public"
                              ? tAdmin("visibilityPublic")
                              : tAdmin("visibilityNonPublic");
                          return (
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                    {survey.title}
                                  </h3>
                                  <Badge variant="secondary">
                                    {visibilityLabel}
                                  </Badge>
                                  <Badge
                                    className={
                                      survey.currentPublishedVersionNumber
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-gray-100 text-gray-600"
                                    }
                                  >
                                    {survey.currentPublishedVersionNumber
                                      ? tAdmin("published")
                                      : tAdmin("draft")}
                                  </Badge>
                                  <Badge
                                    className={
                                      survey.isResponseOpen
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-gray-100 text-gray-600"
                                    }
                                  >
                                    {survey.isResponseOpen
                                      ? tCommon("openResponses")
                                      : tCommon("closeResponses")}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-500 line-clamp-2">
                                  {survey.description}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {survey.author?.slug ? (
                                    <Link
                                      href={withLocale(`/@${survey.author.slug}`, locale)}
                                      className="hover:underline"
                                    >
                                      {tAdmin("authorBy", {
                                        name: survey.author.displayName || tAdmin("authorAnonymous"),
                                      })}
                                    </Link>
                                  ) : (
                                    tAdmin("authorBy", {
                                      name: survey.author?.displayName || tAdmin("authorAnonymous"),
                                    })
                                  )}
                                </p>
                                <div className="text-xs text-gray-400">
                                  {tAdmin("surveyMeta", {
                                    responses: survey.responseCount,
                                    points:
                                      surveyBasePointsDraft +
                                      Math.floor((survey.pointsReward || 0) / 3),
                                  })}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openSurveyEditor(survey)}
                                >
                                  {tCommon("edit")}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteSurvey(survey)}
                                >
                                  {tCommon("delete")}
                                </Button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="datasets" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{tAdmin("datasetsTitle")}</CardTitle>
                <CardDescription>{datasetCountLabel}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <Input
                    placeholder={tAdmin("searchDatasets")}
                    value={datasetSearch}
                    onChange={(event) => setDatasetSearch(event.target.value)}
                    className="md:max-w-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900"
                      value={datasetActive}
                      onChange={(event) => setDatasetActive(event.target.value)}
                    >
                      <option value="all">{tAdmin("activeAll")}</option>
                      <option value="true">{tAdmin("activeOnly")}</option>
                      <option value="false">{tAdmin("inactiveOnly")}</option>
                    </select>
                    <Button onClick={() => setUploadDialogOpen(true)}>
                      {tAdmin("uploadDataset")}
                    </Button>
                  </div>
                </div>

                {datasetLoading ? (
                  <div className="text-sm text-gray-500">
                    {tCommon("loading")}
                  </div>
                ) : datasets.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    {tAdmin("noDatasets")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {datasets.map((dataset) => (
                      <div
                        key={dataset.id}
                        className="flex flex-col gap-3 border border-gray-100 dark:border-gray-800 rounded-lg p-4 bg-white/70 dark:bg-gray-900/70"
                      >
                        {(() => {
                          const accessLabel =
                            dataset.accessType === "paid"
                              ? tAdmin("accessPaid")
                              : tAdmin("accessFree");
                          return (
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                    {dataset.title}
                                  </h3>
                                  <Badge variant="secondary">
                                    {dataset.category}
                                  </Badge>
                                  <Badge
                                    className={
                                      dataset.isActive
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-gray-100 text-gray-600"
                                    }
                                  >
                                    {dataset.isActive
                                      ? tAdmin("active")
                                      : tAdmin("inactive")}
                                  </Badge>
                                  {dataset.currentPublishedVersionNumber ? (
                                    <Badge variant="outline">
                                      {tAdmin("versionLabel", {
                                        version: dataset.currentPublishedVersionNumber,
                                      })}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">{tAdmin("notPublishedYet")}</Badge>
                                  )}
                                  {dataset.hasUnpublishedChanges ? (
                                    <Badge className="bg-amber-100 text-amber-700">
                                      {tAdmin("datasetUnpublishedChanges")}
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="text-sm text-gray-500 line-clamp-2">
                                  {dataset.description}
                                </p>
                                <div className="text-xs text-gray-400">
                                  {tAdmin("datasetMeta", {
                                    access: accessLabel,
                                    samples: dataset.sampleSize,
                                  })}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDatasetEditor(dataset)}
                                >
                                  {tCommon("edit")}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteDataset(dataset)}
                                >
                                  {tCommon("delete")}
                                </Button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deid" className="mt-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{tAdmin("deidReviewsTitle")}</CardTitle>
                  <CardDescription>{deidReviewCountLabel}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {deidReviewLoading ? (
                    <div className="text-sm text-gray-500">{tCommon("loading")}</div>
                  ) : deidReviewJobs.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      {tAdmin("deidNoReviews")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {deidReviewJobs.map((job) => {
                        const summary = job.summary_json || {};
                        const maskedCells =
                          typeof summary.masked_cells === "number"
                            ? summary.masked_cells
                            : 0;
                        return (
                          <button
                            key={job.id}
                            type="button"
                            className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                              selectedDeidReviewId === job.id
                                ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40"
                                : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900"
                            }`}
                            onClick={() => {
                              setSelectedDeidReviewId(job.id);
                              setDeidReviewMessage(null);
                            }}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {job.survey_title || job.survey_id}
                              </p>
                              <Badge variant="secondary">{job.trigger_source}</Badge>
                              <Badge variant="outline">
                                {`${
                                  job.current_chunk_index || 0
                                }/${job.total_chunks || 0}`}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              {tAdmin("deidMaskedCells", { count: maskedCells })}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{tAdmin("deidReviewDetailTitle")}</CardTitle>
                  <CardDescription>
                    {selectedDeidJob
                      ? tAdmin("deidReviewTarget", {
                          survey: selectedDeidJob.survey_title || selectedDeidJob.survey_id,
                        })
                      : tAdmin("deidSelectReviewHint")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {deidReviewDetailLoading ? (
                    <div className="text-sm text-gray-500">{tCommon("loading")}</div>
                  ) : !selectedDeidReviewDetail || !selectedDeidJob ? (
                    <div className="text-sm text-gray-500">
                      {tAdmin("deidSelectReviewHint")}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <div className="rounded-md border border-gray-200 px-3 py-2 text-xs dark:border-gray-800">
                          <p className="text-gray-500">{tAdmin("deidTotalRows")}</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {selectedDeidReviewDetail.total_rows || 0}
                          </p>
                        </div>
                        <div className="rounded-md border border-gray-200 px-3 py-2 text-xs dark:border-gray-800">
                          <p className="text-gray-500">{tAdmin("deidMaskedCellsLabel")}</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {selectedDeidMaskedCount}
                          </p>
                        </div>
                        <div className="rounded-md border border-gray-200 px-3 py-2 text-xs dark:border-gray-800">
                          <p className="text-gray-500">{tAdmin("deidChunkSizeLabel")}</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {selectedDeidJob.chunk_size || 0}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {tAdmin("deidPreviewRowsTitle")}
                        </p>
                        <div className="max-h-56 overflow-auto rounded-md border border-gray-200 dark:border-gray-800">
                          <table className="min-w-full text-xs">
                            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900">
                              <tr>
                                <th className="border-b border-gray-200 px-2 py-1 text-left dark:border-gray-800">
                                  #
                                </th>
                                {selectedDeidReviewDetail.columns.map((column) => (
                                  <th
                                    key={`deid-column-${column.col_no}`}
                                    className="border-b border-gray-200 px-2 py-1 text-left whitespace-nowrap dark:border-gray-800"
                                  >
                                    {`${column.col_no}. ${column.name}`}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {selectedDeidReviewDetail.preview_rows.map((row) => (
                                <tr key={`deid-row-${row.row_no}`}>
                                  <td className="border-b border-gray-100 px-2 py-1 align-top dark:border-gray-900">
                                    {row.row_no}
                                  </td>
                                  {row.cells.map((cell) => (
                                    <td
                                      key={`deid-cell-${row.row_no}-${cell.col_no}`}
                                      className="max-w-48 border-b border-gray-100 px-2 py-1 align-top dark:border-gray-900"
                                    >
                                      <span className="line-clamp-2 break-all">
                                        {cell.value || "-"}
                                      </span>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                        <div className="space-y-1">
                          <Label>{tAdmin("deidReviewActionLabel")}</Label>
                          <select
                            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900"
                            value={deidReviewAction}
                            onChange={(event) =>
                              setDeidReviewAction(
                                event.target.value === "merge" ? "merge" : "create",
                              )
                            }
                          >
                            <option value="create">
                              {tAdmin("deidActionCreateDataset")}
                            </option>
                            <option value="merge">
                              {tAdmin("deidActionMergeDataset")}
                            </option>
                          </select>
                        </div>

                        {deidReviewAction === "merge" ? (
                          <div className="space-y-1">
                            <Label>{tAdmin("deidTargetDatasetLabel")}</Label>
                            <select
                              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900"
                              value={deidReviewForm.datasetId}
                              onChange={(event) =>
                                setDeidReviewForm((previous) => ({
                                  ...previous,
                                  datasetId: event.target.value,
                                }))
                              }
                            >
                              <option value="">{tAdmin("deidTargetDatasetPlaceholder")}</option>
                              {datasets.map((dataset) => (
                                <option key={`deid-dataset-${dataset.id}`} value={dataset.id}>
                                  {`${dataset.title} (${dataset.id.slice(0, 8)})`}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-1">
                              <Label>{tAdmin("datasetTitle")}</Label>
                              <Input
                                value={deidReviewForm.title}
                                onChange={(event) =>
                                  setDeidReviewForm((previous) => ({
                                    ...previous,
                                    title: event.target.value,
                                  }))
                                }
                                placeholder={tAdmin("deidTitlePlaceholder")}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>{tAdmin("datasetDescription")}</Label>
                              <Input
                                value={deidReviewForm.description}
                                onChange={(event) =>
                                  setDeidReviewForm((previous) => ({
                                    ...previous,
                                    description: event.target.value,
                                  }))
                                }
                                placeholder={tAdmin("deidDescriptionPlaceholder")}
                              />
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <Label>{tAdmin("datasetCategory")}</Label>
                                <Input
                                  value={deidReviewForm.category}
                                  onChange={(event) =>
                                    setDeidReviewForm((previous) => ({
                                      ...previous,
                                      category: event.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>{tAdmin("accessType")}</Label>
                                <select
                                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900"
                                  value={deidReviewForm.accessType}
                                  onChange={(event) =>
                                    setDeidReviewForm((previous) => ({
                                      ...previous,
                                      accessType:
                                        event.target.value === "paid" ? "paid" : "free",
                                      price:
                                        event.target.value === "paid"
                                          ? previous.price
                                          : 0,
                                    }))
                                  }
                                >
                                  <option value="free">{tAdmin("accessFree")}</option>
                                  <option value="paid">{tAdmin("accessPaid")}</option>
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <Label>{tAdmin("datasetPrice")}</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={deidReviewForm.price}
                                  onChange={(event) =>
                                    setDeidReviewForm((previous) => ({
                                      ...previous,
                                      price: Math.max(0, Number(event.target.value) || 0),
                                    }))
                                  }
                                  disabled={deidReviewForm.accessType !== "paid"}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>{tAdmin("entitlementPolicyLabel")}</Label>
                                <select
                                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900"
                                  value={deidReviewForm.entitlementPolicy}
                                  onChange={(event) =>
                                    setDeidReviewForm((previous) => ({
                                      ...previous,
                                      entitlementPolicy:
                                        event.target.value === "all_versions_if_any_purchase"
                                          ? "all_versions_if_any_purchase"
                                          : "purchased_only",
                                    }))
                                  }
                                >
                                  <option value="purchased_only">
                                    {tAdmin("entitlementPurchasedOnly")}
                                  </option>
                                  <option value="all_versions_if_any_purchase">
                                    {tAdmin("entitlementAllVersions")}
                                  </option>
                                </select>
                              </div>
                            </div>
                          </>
                        )}

                        <Button
                          onClick={completeDeidReview}
                          disabled={completingDeidReview || !selectedDeidReviewId}
                        >
                          {completingDeidReview
                            ? tCommon("saving")
                            : tAdmin("deidCompleteReview")}
                        </Button>
                        {deidReviewMessage ? (
                          <p className="text-sm text-emerald-600">{deidReviewMessage}</p>
                        ) : null}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="agents" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>{tAdmin("agentsTitle")}</CardTitle>
                    <CardDescription>{agentCountLabel}</CardDescription>
                  </div>
                  <Button onClick={() => openAgentDialog()}>
                    {tAdmin("createAgent")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-3 md:max-w-xl md:flex-row md:items-center">
                    <Input
                      placeholder={tAdmin("searchAgents")}
                      value={agentSearch}
                      onChange={(event) => setAgentSearch(event.target.value)}
                      className="md:w-72"
                    />
                    <select
                      className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 md:w-64"
                      value={
                        currentUser?.isSuperAdmin
                          ? agentOwnerFilter
                          : currentUser?.id || ""
                      }
                      onChange={(event) =>
                        setAgentOwnerFilter(event.target.value)
                      }
                      disabled={!currentUser?.isSuperAdmin}
                    >
                      {availableAgentOwnerOptions.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-gray-500 md:text-right">
                    <div>{tAdmin("agentOwnerFilter")}</div>
                    <div>
                      {currentUser?.isSuperAdmin
                        ? tAdmin("agentOwnerEditable")
                        : tAdmin("agentOwnerLocked")}
                    </div>
                  </div>
                </div>

                {agentLoading ? (
                  <div className="text-sm text-gray-500">
                    {tCommon("loading")}
                  </div>
                ) : agentAccounts.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    {tAdmin("noAgents")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agentAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex flex-col gap-3 border border-gray-100 dark:border-gray-800 rounded-lg p-4 bg-white/70 dark:bg-gray-900/70"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                {account.name}
                              </h3>
                              <Badge
                                className={
                                  account.is_active
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-gray-100 text-gray-600"
                                }
                              >
                                {account.is_active
                                  ? tAdmin("active")
                                  : tAdmin("inactive")}
                              </Badge>
                              {account.key_prefix ? (
                                <Badge variant="secondary">
                                  {account.key_prefix}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-sm text-gray-500">
                              {account.description ||
                                tAdmin("agentNoDescription")}
                            </p>
                            <div className="text-xs text-gray-400">
                              {tAdmin("agentMeta", {
                                permissions: account.permissions.length,
                                owner: getAgentOwnerLabel(account),
                              })}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {account.permissions.map((permission) => (
                                <Badge
                                  key={`${account.id}-${permission}`}
                                  variant="secondary"
                                >
                                  {permission}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAgentDialog(account)}
                            >
                              {tCommon("edit")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => revealAgentKey(account)}
                              disabled={savingAgentId === account.id}
                            >
                              {tAdmin("revealAgentKey")}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openRotateAgentKeyDialog(account)}
                              disabled={savingAgentId === account.id}
                            >
                              {savingAgentId === account.id
                                ? tCommon("saving")
                                : tAdmin("rotateAgentKey")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{tAdmin("usersTitle")}</CardTitle>
                <CardDescription>{userCountLabel}</CardDescription>
                <p className="text-xs text-gray-500">
                  {tAdmin("usersDescription")}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={usersSubTab === "management" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUsersSubTab("management")}
                  >
                    {tAdmin("usersManagementTab")}
                  </Button>
                  <Button
                    type="button"
                    variant={usersSubTab === "points_tool" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUsersSubTab("points_tool")}
                  >
                    {tAdmin("usersPointsToolTab")}
                  </Button>
                </div>

                {usersSubTab === "management" ? (
                  <>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-2 md:max-w-3xl md:flex-row md:items-center">
                    <Input
                      placeholder={tAdmin("searchUsers")}
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      className="md:max-w-sm"
                    />
                    <select
                      className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900"
                      value={userRoleFilter}
                      onChange={(event) => setUserRoleFilter(event.target.value)}
                      data-testid="admin-user-role-filter"
                    >
                      <option value="all">{tAdmin("userRoleAll")}</option>
                      <option value="admin">{tAdmin("userRoleAdmin")}</option>
                      <option value="non_admin">
                        {tAdmin("userRoleNonAdmin")}
                      </option>
                    </select>
                    <select
                      className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900"
                      value={userTierFilter}
                      onChange={(event) => setUserTierFilter(event.target.value)}
                      data-testid="admin-user-tier-filter"
                    >
                      <option value="all">{tAdmin("membershipAll")}</option>
                      {membershipTierOptions.map((tier) => (
                        <option key={`filter-${tier.code}`} value={tier.code}>
                          {tier.code}
                        </option>
                      ))}
                    </select>
                    <select
                      className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900"
                      value={userDisabledFilter}
                      onChange={(event) =>
                        setUserDisabledFilter(event.target.value)
                      }
                      data-testid="admin-user-disabled-filter"
                    >
                      <option value="all">{tAdmin("userDisabledAll")}</option>
                      <option value="false">{tAdmin("userEnabledOnly")}</option>
                      <option value="true">{tAdmin("userDisabledOnly")}</option>
                    </select>
                  </div>
                  {!currentUser?.isSuperAdmin && (
                    <div className="text-xs text-gray-500">
                      {tAdmin("superAdminOnlyHint")}
                    </div>
                  )}
                </div>

                {userLoading ? (
                  <div className="text-sm text-gray-500">
                    {tCommon("loading")}
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    {tAdmin("noUsers")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {users.map((user) => {
                      const label = user.displayName || user.email || user.id;
                      return (
                        <div
                          key={user.id}
                          className="flex flex-col gap-3 border border-gray-100 dark:border-gray-800 rounded-lg p-4 bg-white/70 dark:bg-gray-900/70"
                        >
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                  {label}
                                </h3>
                                {user.isSuperAdmin && (
                                  <Badge className="bg-purple-100 text-purple-700">
                                    {tAdmin("superAdmin")}
                                  </Badge>
                                )}
                                {user.isAdmin && !user.isSuperAdmin && (
                                  <Badge variant="secondary">
                                    {tAdmin("admin")}
                                  </Badge>
                                )}
                                {user.isDisabled ? (
                                  <Badge variant="destructive">
                                    {tAdmin("userDisabled")}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-sm text-gray-500">
                                {user.email}
                              </p>
                            </div>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500">
                                  {tAdmin("membershipTierLabel")}
                                </span>
                                <div className="flex flex-wrap bg-gray-100 dark:bg-gray-800 rounded-md p-1 gap-1">
                                  {membershipTierOptions.map((tier) => {
                                    const draft = membershipDrafts[user.id];
                                    const selectedTier =
                                      draft?.membershipTier ||
                                      user.membershipTier;
                                    if (
                                      tier.isActive === false &&
                                      selectedTier !== tier.code
                                    ) {
                                      return null;
                                    }
                                    return (
                                      <button
                                        key={`${user.id}-${tier.code}`}
                                        type="button"
                                        className={`px-3 py-1 text-xs rounded ${
                                          selectedTier === tier.code
                                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            : "text-gray-500"
                                        }`}
                                        disabled={
                                          !currentUser?.isSuperAdmin ||
                                          savingUserId === user.id
                                        }
                                        onClick={() =>
                                          patchMembershipDraft(user.id, {
                                            membershipTier: tier.code,
                                          })
                                        }
                                        data-testid={`admin-tier-${tier.code}-${user.id}`}
                                      >
                                        {tier.code}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs text-gray-500">
                                  Permanent
                                </span>
                                <Switch
                                  checked={
                                    membershipDrafts[user.id]
                                      ?.membershipIsPermanent ??
                                    user.membershipIsPermanent ??
                                    true
                                  }
                                  onCheckedChange={(checked) =>
                                    patchMembershipDraft(user.id, {
                                      membershipIsPermanent: checked,
                                      membershipPeriodEndAt: checked
                                        ? ""
                                        : membershipDrafts[user.id]
                                            ?.membershipPeriodEndAt || "",
                                    })
                                  }
                                  disabled={
                                    !currentUser?.isSuperAdmin ||
                                    savingUserId === user.id
                                  }
                                  data-testid={`admin-membership-permanent-${user.id}`}
                                />
                                <Input
                                  type="date"
                                  value={
                                    membershipDrafts[user.id]
                                      ?.membershipPeriodEndAt || ""
                                  }
                                  onChange={(event) =>
                                    patchMembershipDraft(user.id, {
                                      membershipPeriodEndAt: event.target.value,
                                    })
                                  }
                                  disabled={
                                    !currentUser?.isSuperAdmin ||
                                    savingUserId === user.id ||
                                    (membershipDrafts[user.id]
                                      ?.membershipIsPermanent ??
                                      user.membershipIsPermanent ??
                                      true)
                                  }
                                  className="w-44"
                                  data-testid={`admin-membership-end-at-${user.id}`}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => saveMembershipGrant(user)}
                                  disabled={
                                    !currentUser?.isSuperAdmin ||
                                    savingUserId === user.id
                                  }
                                  data-testid={`admin-membership-save-${user.id}`}
                                >
                                  {savingUserId === user.id
                                    ? tCommon("saving")
                                    : tCommon("save")}
                                </Button>
                              </div>
                              <span className="text-xs text-gray-500">
                                {tAdmin("userDisableToggleLabel")}
                              </span>
                              <Switch
                                checked={Boolean(user.isDisabled)}
                                onCheckedChange={(checked) =>
                                  toggleUserDisabled(user, checked)
                                }
                                aria-label={tAdmin("userDisableToggleLabel")}
                                data-testid={`admin-user-disabled-${user.id}`}
                                disabled={
                                  !currentUser?.isSuperAdmin ||
                                  user.isSuperAdmin ||
                                  savingUserId === user.id
                                }
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                  </>
                ) : null}

                {usersSubTab === "points_tool" ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <Input
                        placeholder={tAdmin("pointsToolSearchPlaceholder")}
                        value={pointsToolSearch}
                        onChange={(event) => setPointsToolSearch(event.target.value)}
                        className="md:max-w-sm"
                      />
                      <select
                        className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900"
                        value={pointsToolTierFilter}
                        onChange={(event) =>
                          setPointsToolTierFilter(event.target.value)
                        }
                      >
                        <option value="all">{tAdmin("membershipAll")}</option>
                        {membershipTierOptions.map((tier) => (
                          <option key={`points-filter-${tier.code}`} value={tier.code}>
                            {tier.code}
                          </option>
                        ))}
                      </select>
                      <select
                        className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900"
                        value={pointsToolDisabledFilter}
                        onChange={(event) =>
                          setPointsToolDisabledFilter(event.target.value)
                        }
                      >
                        <option value="all">{tAdmin("userDisabledAll")}</option>
                        <option value="false">{tAdmin("userEnabledOnly")}</option>
                        <option value="true">{tAdmin("userDisabledOnly")}</option>
                      </select>
                    </div>

                    <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 space-y-3">
                      <div className="text-sm font-medium">{tAdmin("pointsToolBatchTitle")}</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">{tAdmin("pointsToolDeltaLabel")}</Label>
                          <Input
                            type="number"
                            value={pointsDeltaDraft}
                            onChange={(event) => setPointsDeltaDraft(event.target.value)}
                            data-testid="points-tool-delta"
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <Label className="text-xs text-gray-500">{tAdmin("pointsToolReasonLabel")}</Label>
                          <Input
                            value={pointsReasonDraft}
                            onChange={(event) => setPointsReasonDraft(event.target.value)}
                            placeholder={tAdmin("pointsToolReasonPlaceholder")}
                            data-testid="points-tool-reason"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          onClick={submitPointsAdjustment}
                          disabled={applyingPointsAdjust}
                          data-testid="points-tool-apply"
                        >
                          {applyingPointsAdjust ? tCommon("saving") : tAdmin("pointsToolApplySelected")}
                        </Button>
                        <span className="text-xs text-gray-500">
                          {tAdmin("pointsToolSelectedUsers", { count: selectedPointsUserIds.length })}
                        </span>
                      </div>
                    </div>

                    {pointsToolLoading ? (
                      <div className="text-sm text-gray-500">{tCommon("loading")}</div>
                    ) : pointsToolUsers.length === 0 ? (
                      <div className="text-sm text-gray-500">{tAdmin("pointsToolNoUsers")}</div>
                    ) : (
                      <div className="space-y-2">
                        <label className="inline-flex items-center gap-2 text-xs text-gray-500">
                          <input
                            type="checkbox"
                            checked={
                              pointsToolUsers.length > 0 &&
                              selectedPointsUserIds.length === pointsToolUsers.length
                            }
                            onChange={(event) =>
                              setSelectedPointsUserIds(
                                event.target.checked
                                  ? pointsToolUsers.map((user) => user.id)
                                  : [],
                              )
                            }
                            data-testid="points-tool-select-all"
                          />
                          {tAdmin("pointsToolSelectAllFiltered")}
                        </label>
                        {pointsToolUsers.map((user) => {
                          const label = user.displayName || user.email || user.id;
                          const pointsBalance = Number(user.pointsBalance || 0);
                          return (
                            <div
                              key={`points-${user.id}`}
                              className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 text-sm dark:border-gray-800"
                            >
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedPointsUserIds.includes(user.id)}
                                  onChange={(event) =>
                                    togglePointsUserSelection(user.id, event.target.checked)
                                  }
                                  data-testid={`points-tool-user-${user.id}`}
                                />
                                <span>{label}</span>
                                <span className="text-xs text-gray-500">
                                  ({user.membershipTier})
                                </span>
                              </label>
                              <div className="text-xs text-gray-500">
                                {pointsBalance.toLocaleString()} pts
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admins" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>{tAdmin("adminsTitle")}</CardTitle>
                    <CardDescription>{adminCountLabel}</CardDescription>
                    <p className="text-xs text-gray-500">
                      {tAdmin("addAdminExistingUsersHint")}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setAddAdminSearch("");
                      setAddAdminCandidates([]);
                      setSelectedAddAdminUserId("");
                      setAddAdminDialogOpen(true);
                    }}
                    disabled={!currentUser?.isSuperAdmin}
                    data-testid="admin-add-button"
                  >
                    {tAdmin("addAdminAction")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder={tAdmin("searchAdmins")}
                  value={adminSearch}
                  onChange={(event) => setAdminSearch(event.target.value)}
                  className="md:max-w-sm"
                />

                {adminUserLoading ? (
                  <div className="text-sm text-gray-500">
                    {tCommon("loading")}
                  </div>
                ) : adminUsers.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    {tAdmin("noAdmins")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adminUsers.map((user) => {
                      const label = user.displayName || user.email || user.id;
                      return (
                        <div
                          key={user.id}
                          className="flex flex-col gap-3 border border-gray-100 dark:border-gray-800 rounded-lg p-4 bg-white/70 dark:bg-gray-900/70"
                        >
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                  {label}
                                </h3>
                                {user.isSuperAdmin ? (
                                  <Badge className="bg-purple-100 text-purple-700">
                                    {tAdmin("superAdmin")}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">
                                    {tAdmin("admin")}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">
                                {user.email}
                              </p>
                            </div>
                            <div className="flex flex-col gap-2">
                              <span className="text-xs text-gray-500">
                                {tAdmin("adminToggleLabel")}
                              </span>
                              <Switch
                                checked={user.isAdmin || user.isSuperAdmin}
                                onCheckedChange={(checked) =>
                                  toggleAdmin(user, checked)
                                }
                                aria-label={tAdmin("adminToggleLabel")}
                                data-testid={`admin-admin-${user.id}`}
                                disabled={
                                  !currentUser?.isSuperAdmin ||
                                  user.isSuperAdmin ||
                                  savingUserId === user.id
                                }
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog
              open={addAdminDialogOpen}
              onOpenChange={(open) => {
                setAddAdminDialogOpen(open);
                if (!open) {
                  setAddAdminSearch("");
                  setAddAdminCandidates([]);
                  setSelectedAddAdminUserId("");
                }
              }}
            >
              <DialogContent data-testid="admin-add-modal">
                <DialogHeader>
                  <DialogTitle>{tAdmin("addAdminDialogTitle")}</DialogTitle>
                  <DialogDescription>
                    {tAdmin("addAdminDialogDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder={tAdmin("addAdminSearchPlaceholder")}
                    value={addAdminSearch}
                    onChange={(event) => setAddAdminSearch(event.target.value)}
                    data-testid="admin-add-search"
                  />
                  <select
                    className="w-full border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900"
                    value={selectedAddAdminUserId}
                    onChange={(event) =>
                      setSelectedAddAdminUserId(event.target.value)
                    }
                    data-testid="admin-add-select"
                  >
                    {addAdminCandidates.map((candidate) => {
                      const label =
                        candidate.displayName || candidate.email || candidate.id;
                      return (
                        <option key={candidate.id} value={candidate.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  {addAdminCandidatesLoading ? (
                    <p className="text-xs text-gray-500">{tAdmin("addAdminLoadingUsers")}</p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddAdminDialogOpen(false)}
                  >
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    type="button"
                    onClick={promoteSelectedUserToAdmin}
                    disabled={addingAdmin || !selectedAddAdminUserId}
                    data-testid="admin-add-confirm"
                  >
                    {addingAdmin ? tCommon("saving") : tAdmin("addAdminConfirmAction")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="policies" className="mt-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{tAdmin("policiesTitle")}</CardTitle>
                  <CardDescription>{policyWriterCountLabel}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="text-sm font-medium">{tAdmin("systemSettingsTitle")}</div>
                  <div className="flex flex-wrap items-end gap-3 border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">
                        {tAdmin("surveyBasePointsLabel")}
                      </Label>
                      <Input
                        className="w-40"
                        type="number"
                        min={0}
                        value={surveyBasePointsDraft}
                        onChange={(event) =>
                          setSurveyBasePointsDraft(
                            Math.max(0, Number(event.target.value) || 0),
                          )
                        }
                        disabled={
                          !canWritePolicies ||
                          systemSettingsLoading ||
                          savingSystemSettings
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">
                        {tAdmin("signupInitialPoints")}
                      </Label>
                      <Input
                        className="w-40"
                        type="number"
                        min={0}
                        value={signupInitialPointsDraft}
                        onChange={(event) =>
                          setSignupInitialPointsDraft(
                            Math.max(0, Number(event.target.value) || 0),
                          )
                        }
                        disabled={
                          !canWritePolicies ||
                          systemSettingsLoading ||
                          savingSystemSettings
                        }
                        data-testid="admin-signup-initial-points"
                      />
                    </div>
                    <Button
                      onClick={saveSystemSettings}
                      disabled={
                        !canWritePolicies ||
                        systemSettingsLoading ||
                        savingSystemSettings
                      }
                    >
                      {savingSystemSettings
                        ? tCommon("saving")
                        : tCommon("save")}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    {tAdmin("surveyBasePointsHint")}
                  </p>
                  <p className="text-xs text-gray-500">
                    {tAdmin("signupInitialPointsHint")}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm font-medium">
                      {tAdmin("capabilityLabel")}
                    </div>
                    <Button
                      onClick={savePolicies}
                      disabled={!canWritePolicies || policySaving}
                    >
                      {policySaving
                        ? tCommon("saving")
                        : tAdmin("savePolicyMatrix")}
                    </Button>
                  </div>

                  {policyLoading ? (
                    <div className="text-sm text-gray-500">
                      {tCommon("loading")}
                    </div>
                  ) : activeTiers.length === 0 || capabilities.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      {tAdmin("noPolicies")}
                    </div>
                  ) : (
                    <div className="overflow-auto border border-gray-100 dark:border-gray-800 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/60">
                          <tr>
                            <th className="text-left px-3 py-2">
                              {tAdmin("capabilityLabel")}
                            </th>
                            {activeTiers.map((tier) => (
                              <th key={tier.code} className="text-left px-3 py-2">
                                {tier.code}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {capabilities.map((capability) => (
                            <tr
                              key={capability.key}
                              className="border-t border-gray-100 dark:border-gray-800"
                            >
                              <td className="px-3 py-2">
                                <div className="font-medium">
                                  {capability.key}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {capability.description}
                                </div>
                              </td>
                              {activeTiers.map((tier) => (
                                <td
                                  key={`${capability.key}-${tier.code}`}
                                  className="px-3 py-2"
                                >
                                  <Switch
                                    checked={policyMatrixValue(
                                      tier.code,
                                      capability.key,
                                    )}
                                    onCheckedChange={(checked) =>
                                      updatePolicyMatrixValue(
                                        tier.code,
                                        capability.key,
                                        checked,
                                      )
                                    }
                                    disabled={!canWritePolicies}
                                    data-testid={`policy-${tier.code}-${capability.key}`}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium">
                    {tAdmin("subscriptionPlansTitle")}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {activeTiers.map((tier) => (
                      <div
                        key={tier.id}
                        className="border border-gray-100 dark:border-gray-800 rounded-lg p-3 space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{tier.code}</div>
                          <Badge
                            variant={
                              tier.isActive === false ? "secondary" : "default"
                            }
                          >
                            {tier.isActive === false
                              ? tAdmin("inactive")
                              : tAdmin("active")}
                          </Badge>
                          {tier.replacementTierCode && (
                            <span className="text-xs text-gray-500">
                              {tAdmin("planRetirementOnExpiryTo", {
                                code: tier.replacementTierCode,
                              })}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("planNameZhTWLabel")}
                            </Label>
                            <Input
                              value={tier.nameI18n?.["zh-TW"] || ""}
                              onChange={(event) =>
                                setTiers((prev) =>
                                  prev.map((item) =>
                                    item.id === tier.id
                                      ? {
                                          ...item,
                                          nameI18n: {
                                            ...(item.nameI18n || {}),
                                            "zh-TW": event.target.value,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={tAdmin("planNameZhTWPlaceholder")}
                              disabled={!canWritePolicies}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("planNameEnLabel")}
                            </Label>
                            <Input
                              value={tier.nameI18n?.en || ""}
                              onChange={(event) =>
                                setTiers((prev) =>
                                  prev.map((item) =>
                                    item.id === tier.id
                                      ? {
                                          ...item,
                                          nameI18n: {
                                            ...(item.nameI18n || {}),
                                            en: event.target.value,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={tAdmin("planNameEnPlaceholder")}
                              disabled={!canWritePolicies}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("planNameJaLabel")}
                            </Label>
                            <Input
                              value={tier.nameI18n?.ja || ""}
                              onChange={(event) =>
                                setTiers((prev) =>
                                  prev.map((item) =>
                                    item.id === tier.id
                                      ? {
                                          ...item,
                                          nameI18n: {
                                            ...(item.nameI18n || {}),
                                            ja: event.target.value,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={tAdmin("planNameJaPlaceholder")}
                              disabled={!canWritePolicies}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("planDescriptionZhTWLabel")}
                            </Label>
                            <Input
                              value={tier.descriptionI18n?.["zh-TW"] || ""}
                              onChange={(event) =>
                                setTiers((prev) =>
                                  prev.map((item) =>
                                    item.id === tier.id
                                      ? {
                                          ...item,
                                          descriptionI18n: {
                                            ...(item.descriptionI18n || {}),
                                            "zh-TW": event.target.value,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={tAdmin("planDescriptionZhTWPlaceholder")}
                              disabled={!canWritePolicies}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("planDescriptionEnLabel")}
                            </Label>
                            <Input
                              value={tier.descriptionI18n?.en || ""}
                              onChange={(event) =>
                                setTiers((prev) =>
                                  prev.map((item) =>
                                    item.id === tier.id
                                      ? {
                                          ...item,
                                          descriptionI18n: {
                                            ...(item.descriptionI18n || {}),
                                            en: event.target.value,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={tAdmin("planDescriptionEnPlaceholder")}
                              disabled={!canWritePolicies}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("planDescriptionJaLabel")}
                            </Label>
                            <Input
                              value={tier.descriptionI18n?.ja || ""}
                              onChange={(event) =>
                                setTiers((prev) =>
                                  prev.map((item) =>
                                    item.id === tier.id
                                      ? {
                                          ...item,
                                          descriptionI18n: {
                                            ...(item.descriptionI18n || {}),
                                            ja: event.target.value,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={tAdmin("planDescriptionJaPlaceholder")}
                              disabled={!canWritePolicies}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("planPriceCentsLabel")}
                            </Label>
                            <Input
                              className="w-40"
                              type="number"
                              value={tier.priceCentsUsd ?? 0}
                              onChange={(event) =>
                                setTiers((prev) =>
                                  prev.map((item) =>
                                    item.id === tier.id
                                      ? {
                                          ...item,
                                          priceCentsUsd: Number(
                                            event.target.value,
                                          ),
                                        }
                                      : item,
                                  ),
                                )
                              }
                              disabled={!canWritePolicies}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("planMonthlyPointsGrantLabel")}
                            </Label>
                            <Input
                              className="w-40"
                              type="number"
                              value={tier.monthlyPointsGrant ?? 0}
                              onChange={(event) =>
                                setTiers((prev) =>
                                  prev.map((item) =>
                                    item.id === tier.id
                                      ? {
                                          ...item,
                                          monthlyPointsGrant: Number(
                                            event.target.value,
                                          ),
                                        }
                                      : item,
                                  ),
                                )
                              }
                              disabled={!canWritePolicies}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("planMaxActiveSurveysLabel")}
                            </Label>
                            <Input
                              className="w-40"
                              type="number"
                              min={0}
                              value={tier.maxActiveSurveys ?? ""}
                              onChange={(event) =>
                                setTiers((prev) =>
                                  prev.map((item) =>
                                    item.id === tier.id
                                      ? {
                                          ...item,
                                          maxActiveSurveys: Math.max(
                                            0,
                                            Number(event.target.value) || 0,
                                          ),
                                        }
                                      : item,
                                  ),
                                )
                              }
                              disabled={
                                !canWritePolicies ||
                                tier.maxActiveSurveys == null
                              }
                            />
                          </div>
                          <Label className="text-xs">
                            {tAdmin("planUnlimitedActiveSurveysLabel")}
                          </Label>
                          <Switch
                            checked={tier.maxActiveSurveys == null}
                            onCheckedChange={(checked) =>
                              setTiers((prev) =>
                                prev.map((item) =>
                                  item.id === tier.id
                                    ? {
                                        ...item,
                                        maxActiveSurveys: checked
                                          ? null
                                          : Math.max(
                                              0,
                                              item.maxActiveSurveys ?? 0,
                                            ),
                                      }
                                    : item,
                                ),
                              )
                            }
                            disabled={!canWritePolicies}
                          />
                          <Label className="text-xs">
                            {tAdmin("planShowOnPricingLabel")}
                          </Label>
                          <Switch
                            checked={tier.showOnPricing ?? false}
                            onCheckedChange={(checked) =>
                              setTiers((prev) =>
                                prev.map((item) =>
                                  item.id === tier.id
                                    ? { ...item, showOnPricing: checked }
                                    : item,
                                ),
                              )
                            }
                            disabled={!canWritePolicies}
                          />
                          <Label className="text-xs">
                            {tAdmin("planPurchasableLabel")}
                          </Label>
                          <Switch
                            checked={tier.isPurchasable ?? false}
                            onCheckedChange={(checked) =>
                              setTiers((prev) =>
                                prev.map((item) =>
                                  item.id === tier.id
                                    ? { ...item, isPurchasable: checked }
                                    : item,
                                ),
                              )
                            }
                            disabled={!canWritePolicies}
                          />
                          <Label className="text-xs">
                            {tAdmin("planRenewalLabel")}
                          </Label>
                          <Switch
                            checked={tier.allowRenewalForExisting ?? false}
                            onCheckedChange={(checked) =>
                              setTiers((prev) =>
                                prev.map((item) =>
                                  item.id === tier.id
                                    ? {
                                        ...item,
                                        allowRenewalForExisting: checked,
                                      }
                                    : item,
                                ),
                              )
                            }
                            disabled={!canWritePolicies}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => savePlan(tier)}
                            disabled={
                              !canWritePolicies || savingPlanId === tier.id
                            }
                          >
                            {savingPlanId === tier.id
                              ? tCommon("saving")
                              : tCommon("save")}
                          </Button>
                        </div>
                        {tier.code !== "free" && tier.isActive !== false && (
                          <div className="flex flex-wrap items-end gap-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">
                                Replacement plan
                              </Label>
                              <select
                                className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 min-w-36"
                                value={
                                  planRetirementDrafts[tier.id]
                                    ?.replacementTierCode || ""
                                }
                                onChange={(event) =>
                                  patchPlanRetirementDraft(tier.id, {
                                    replacementTierCode: event.target.value,
                                  })
                                }
                                disabled={
                                  !canWritePolicies ||
                                  deactivatingPlanId === tier.id
                                }
                              >
                                <option value="">
                                  {tAdmin("planSelectPlaceholder")}
                                </option>
                                {tiers
                                  .filter(
                                    (candidate) =>
                                      candidate.id !== tier.id &&
                                      candidate.isActive !== false,
                                  )
                                  .map((candidate) => (
                                    <option
                                      key={candidate.id}
                                      value={candidate.code}
                                    >
                                      {candidate.code}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">
                                {tAdmin("planExecutionLabel")}
                              </Label>
                              <select
                                className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 min-w-36"
                                value={
                                  planRetirementDrafts[tier.id]
                                    ?.executionTiming || "immediate"
                                }
                                onChange={(event) =>
                                  patchPlanRetirementDraft(tier.id, {
                                    executionTiming:
                                      event.target.value === "on_expiry"
                                        ? "on_expiry"
                                        : "immediate",
                                  })
                                }
                                disabled={
                                  !canWritePolicies ||
                                  deactivatingPlanId === tier.id
                                }
                              >
                                <option value="immediate">{tAdmin("planRetirementImmediate")}</option>
                                <option value="on_expiry">{tAdmin("planRetirementOnExpiry")}</option>
                              </select>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deactivatePlan(tier)}
                              disabled={
                                !canWritePolicies ||
                                deactivatingPlanId === tier.id ||
                                !(
                                  planRetirementDrafts[tier.id]
                                    ?.replacementTierCode || ""
                                )
                              }
                            >
                              {deactivatingPlanId === tier.id
                                ? tCommon("saving")
                                : tAdmin("deactivatePlanAction")}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {inactiveTiers.length > 0 ? (
                    <details
                      className="rounded-lg border border-gray-100 bg-white/70 p-3 dark:border-gray-800 dark:bg-gray-900/70"
                      data-testid="admin-inactive-plans-collapsible"
                    >
                      <summary className="cursor-pointer text-sm font-medium">
                        {tAdmin("inactivePlansTitle", {
                          count: inactiveTiers.length,
                        })}
                      </summary>
                      <div className="mt-3 space-y-2">
                        {inactiveTiers.map((tier) => (
                          <div
                            key={`inactive-${tier.id}`}
                            className="rounded-md border border-gray-100 px-3 py-2 text-sm dark:border-gray-800"
                            data-testid={`admin-inactive-plan-${tier.code}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{tier.code}</span>
                              <Badge variant="secondary">{tAdmin("inactive")}</Badge>
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {tAdmin("inactivePlanReplacement", {
                                code: tier.replacementTierCode || "free",
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}

                  <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
                    <div className="text-sm font-medium">
                      {tAdmin("newPlanTitle")}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">
                          {tAdmin("planCodeLabel")}
                        </Label>
                        <Input
                          value={newPlan.code}
                          onChange={(event) => {
                            clearNewPlanFieldError("code");
                            setNewPlan((prev) => ({
                              ...prev,
                              code: event.target.value,
                            }));
                          }}
                          placeholder={tAdmin("planCodePlaceholder")}
                          disabled={!canWritePolicies}
                        />
                        {newPlanFieldErrors.code ? (
                          <p className="text-xs text-red-600">
                            {newPlanFieldErrors.code}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">
                          {tAdmin("planPriceCentsLabel")}
                        </Label>
                        <Input
                          type="number"
                          value={newPlan.priceCentsUsd}
                          onChange={(event) => {
                            clearNewPlanFieldError("priceCentsUsd");
                            setNewPlan((prev) => ({
                              ...prev,
                              priceCentsUsd: Number(event.target.value),
                            }));
                          }}
                          placeholder="price cents usd"
                          disabled={!canWritePolicies}
                        />
                        {newPlanFieldErrors.priceCentsUsd ? (
                          <p className="text-xs text-red-600">
                            {newPlanFieldErrors.priceCentsUsd}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">
                          {tAdmin("planMonthlyPointsGrantLabel")}
                        </Label>
                        <Input
                          type="number"
                          value={newPlan.monthlyPointsGrant}
                          onChange={(event) => {
                            clearNewPlanFieldError("monthlyPointsGrant");
                            setNewPlan((prev) => ({
                              ...prev,
                              monthlyPointsGrant: Number(event.target.value),
                            }));
                          }}
                          placeholder="monthly points"
                          disabled={!canWritePolicies}
                        />
                        {newPlanFieldErrors.monthlyPointsGrant ? (
                          <p className="text-xs text-red-600">
                            {newPlanFieldErrors.monthlyPointsGrant}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">
                          {tAdmin("planMaxActiveSurveysLabel")}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={newPlan.maxActiveSurveys ?? ""}
                          onChange={(event) =>
                            setNewPlan((prev) => ({
                              ...prev,
                              maxActiveSurveys: Math.max(
                                0,
                                Number(event.target.value) || 0,
                              ),
                            }))
                          }
                          placeholder="active surveys limit"
                          disabled={
                            !canWritePolicies ||
                            newPlan.maxActiveSurveys == null
                          }
                        />
                      </div>
                      <Button
                        className="md:self-end"
                        onClick={createPlan}
                        disabled={!canWritePolicies || creatingPlan}
                      >
                        {creatingPlan ? tCommon("saving") : "Create Plan"}
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Label className="text-xs">
                          {tAdmin("planUnlimitedActiveSurveysLabel")}
                        </Label>
                      <Switch
                        checked={newPlan.maxActiveSurveys == null}
                        onCheckedChange={(checked) =>
                          setNewPlan((prev) => ({
                            ...prev,
                            maxActiveSurveys: checked
                              ? null
                              : Math.max(0, prev.maxActiveSurveys ?? 0),
                          }))
                        }
                        disabled={!canWritePolicies}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">
                          {tAdmin("planNameZhTWLabel")}
                        </Label>
                        <Input
                          value={newPlan.nameI18n["zh-TW"]}
                          onChange={(event) => {
                            clearNewPlanFieldError("nameZhTW");
                            setNewPlan((prev) => ({
                              ...prev,
                              nameI18n: {
                                ...prev.nameI18n,
                                "zh-TW": event.target.value,
                              },
                            }));
                          }}
                          placeholder={tAdmin("planNameZhTWPlaceholder")}
                          disabled={!canWritePolicies}
                        />
                        {newPlanFieldErrors.nameZhTW ? (
                          <p className="text-xs text-red-600">
                            {newPlanFieldErrors.nameZhTW}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">
                          {tAdmin("planNameEnLabel")}
                        </Label>
                        <Input
                          value={newPlan.nameI18n.en}
                          onChange={(event) => {
                            clearNewPlanFieldError("nameEn");
                            setNewPlan((prev) => ({
                              ...prev,
                              nameI18n: {
                                ...prev.nameI18n,
                                en: event.target.value,
                              },
                            }));
                          }}
                          placeholder={tAdmin("planNameEnPlaceholder")}
                          disabled={!canWritePolicies}
                        />
                        {newPlanFieldErrors.nameEn ? (
                          <p className="text-xs text-red-600">
                            {newPlanFieldErrors.nameEn}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">
                          {tAdmin("planNameJaLabel")}
                        </Label>
                        <Input
                          value={newPlan.nameI18n.ja}
                          onChange={(event) => {
                            clearNewPlanFieldError("nameJa");
                            setNewPlan((prev) => ({
                              ...prev,
                              nameI18n: {
                                ...prev.nameI18n,
                                ja: event.target.value,
                              },
                            }));
                          }}
                          placeholder={tAdmin("planNameJaPlaceholder")}
                          disabled={!canWritePolicies}
                        />
                        {newPlanFieldErrors.nameJa ? (
                          <p className="text-xs text-red-600">
                            {newPlanFieldErrors.nameJa}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">
                          {tAdmin("planDescriptionZhTWLabel")}
                        </Label>
                        <Input
                          value={newPlan.descriptionI18n["zh-TW"]}
                          onChange={(event) => {
                            clearNewPlanFieldError("descriptionZhTW");
                            setNewPlan((prev) => ({
                              ...prev,
                              descriptionI18n: {
                                ...prev.descriptionI18n,
                                "zh-TW": event.target.value,
                              },
                            }));
                          }}
                          placeholder={tAdmin("planDescriptionZhTWPlaceholder")}
                          disabled={!canWritePolicies}
                        />
                        {newPlanFieldErrors.descriptionZhTW ? (
                          <p className="text-xs text-red-600">
                            {newPlanFieldErrors.descriptionZhTW}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">
                          {tAdmin("planDescriptionEnLabel")}
                        </Label>
                        <Input
                          value={newPlan.descriptionI18n.en}
                          onChange={(event) => {
                            clearNewPlanFieldError("descriptionEn");
                            setNewPlan((prev) => ({
                              ...prev,
                              descriptionI18n: {
                                ...prev.descriptionI18n,
                                en: event.target.value,
                              },
                            }));
                          }}
                          placeholder={tAdmin("planDescriptionEnPlaceholder")}
                          disabled={!canWritePolicies}
                        />
                        {newPlanFieldErrors.descriptionEn ? (
                          <p className="text-xs text-red-600">
                            {newPlanFieldErrors.descriptionEn}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">
                          {tAdmin("planDescriptionJaLabel")}
                        </Label>
                        <Input
                          value={newPlan.descriptionI18n.ja}
                          onChange={(event) => {
                            clearNewPlanFieldError("descriptionJa");
                            setNewPlan((prev) => ({
                              ...prev,
                              descriptionI18n: {
                                ...prev.descriptionI18n,
                                ja: event.target.value,
                              },
                            }));
                          }}
                          placeholder={tAdmin("planDescriptionJaPlaceholder")}
                          disabled={!canWritePolicies}
                        />
                        {newPlanFieldErrors.descriptionJa ? (
                          <p className="text-xs text-red-600">
                            {newPlanFieldErrors.descriptionJa}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium">
                    {tAdmin("capabilityDisplayTitle")}
                  </div>
                  <div className="space-y-2">
                    {capabilities.map((capability) => (
                      <div
                        key={capability.id}
                        className="border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2 space-y-2"
                      >
                        <div className="text-sm font-medium">
                          {capability.key}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("benefitNameZhTWLabel")}
                            </Label>
                            <Input
                              value={capability.nameI18n?.["zh-TW"] || ""}
                              onChange={(event) =>
                                setCapabilities((prev) =>
                                  prev.map((item) =>
                                    item.id === capability.id
                                      ? {
                                          ...item,
                                          nameI18n: {
                                            ...(item.nameI18n || {}),
                                            "zh-TW": event.target.value,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={tAdmin("benefitNameZhTWPlaceholder")}
                              disabled={!canWritePolicies}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("benefitNameEnLabel")}
                            </Label>
                            <Input
                              value={capability.nameI18n?.en || ""}
                              onChange={(event) =>
                                setCapabilities((prev) =>
                                  prev.map((item) =>
                                    item.id === capability.id
                                      ? {
                                          ...item,
                                          nameI18n: {
                                            ...(item.nameI18n || {}),
                                            en: event.target.value,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={tAdmin("benefitNameEnPlaceholder")}
                              disabled={!canWritePolicies}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("benefitNameJaLabel")}
                            </Label>
                            <Input
                              value={capability.nameI18n?.ja || ""}
                              onChange={(event) =>
                                setCapabilities((prev) =>
                                  prev.map((item) =>
                                    item.id === capability.id
                                      ? {
                                          ...item,
                                          nameI18n: {
                                            ...(item.nameI18n || {}),
                                            ja: event.target.value,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={tAdmin("benefitNameJaPlaceholder")}
                              disabled={!canWritePolicies}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("benefitDescriptionZhTWLabel")}
                            </Label>
                            <Input
                              value={
                                capability.descriptionI18n?.["zh-TW"] || ""
                              }
                              onChange={(event) =>
                                setCapabilities((prev) =>
                                  prev.map((item) =>
                                    item.id === capability.id
                                      ? {
                                          ...item,
                                          descriptionI18n: {
                                            ...(item.descriptionI18n || {}),
                                            "zh-TW": event.target.value,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={tAdmin("benefitDescriptionZhTWPlaceholder")}
                              disabled={!canWritePolicies}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("benefitDescriptionEnLabel")}
                            </Label>
                            <Input
                              value={capability.descriptionI18n?.en || ""}
                              onChange={(event) =>
                                setCapabilities((prev) =>
                                  prev.map((item) =>
                                    item.id === capability.id
                                      ? {
                                          ...item,
                                          descriptionI18n: {
                                            ...(item.descriptionI18n || {}),
                                            en: event.target.value,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={tAdmin("benefitDescriptionEnPlaceholder")}
                              disabled={!canWritePolicies}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">
                              {tAdmin("benefitDescriptionJaLabel")}
                            </Label>
                            <Input
                              value={capability.descriptionI18n?.ja || ""}
                              onChange={(event) =>
                                setCapabilities((prev) =>
                                  prev.map((item) =>
                                    item.id === capability.id
                                      ? {
                                          ...item,
                                          descriptionI18n: {
                                            ...(item.descriptionI18n || {}),
                                            ja: event.target.value,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={tAdmin("benefitDescriptionJaPlaceholder")}
                              disabled={!canWritePolicies}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Label className="text-xs">
                            {tAdmin("planShowOnPricingLabel")}
                          </Label>
                          <Switch
                            checked={capability.showOnPricing ?? false}
                            onCheckedChange={(checked) =>
                              setCapabilities((prev) =>
                                prev.map((item) =>
                                  item.id === capability.id
                                    ? { ...item, showOnPricing: checked }
                                    : item,
                                ),
                              )
                            }
                            disabled={!canWritePolicies}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => saveCapability(capability)}
                            disabled={
                              !canWritePolicies ||
                              savingCapabilityId === capability.id
                            }
                          >
                            {savingCapabilityId === capability.id
                              ? tCommon("saving")
                              : tCommon("save")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium">
                    {tAdmin("policyWritersTitle")}
                  </div>
                  {policyWriters.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      {tAdmin("noPolicyWriters")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {policyWriters.map((writer) => (
                        <div
                          key={writer.id}
                          className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2"
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {writer.displayName || writer.email || writer.id}
                            </div>
                            <div className="text-xs text-gray-500">
                              {writer.email}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {tAdmin("policyWriterToggleLabel")}
                            </span>
                            <Switch
                              checked={writer.canWritePolicy}
                              onCheckedChange={(checked) =>
                                setPolicyWriter(writer.id, checked)
                              }
                              disabled={
                                !currentUser?.isSuperAdmin ||
                                writer.isSuperAdmin ||
                                savingPolicyWriterId === writer.id
                              }
                              data-testid={`policy-writer-${writer.id}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={insufficientDialogOpen}
        onOpenChange={(open) => {
          setInsufficientDialogOpen(open);
          if (!open) {
            setPendingPointsAdjustRequest(null);
            setInsufficientUsers([]);
          }
        }}
      >
        <DialogContent data-testid="points-tool-insufficient-dialog">
          <DialogHeader>
            <DialogTitle>{tAdmin("pointsInsufficientTitle")}</DialogTitle>
            <DialogDescription>
              {tAdmin("pointsInsufficientDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {insufficientUsers.map((item) => (
              <div
                key={`${item.userId}-${item.pointsBalance}`}
                className="rounded-md border border-gray-100 px-3 py-2 text-xs dark:border-gray-800"
              >
                <div>
                  {tAdmin("pointsInsufficientUser", { userId: item.userId })}
                </div>
                <div>
                  {tAdmin("pointsInsufficientBalance", {
                    balance: item.pointsBalance,
                  })}
                </div>
                <div>
                  {tAdmin("pointsInsufficientRequiredDeduction", {
                    requiredDeduction: item.requiredDeduction,
                  })}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => applyPointsAdjustmentStrategy("reject_all")}
              disabled={applyingPointsAdjust}
            >
              {tAdmin("pointsStrategyRejectAll")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => applyPointsAdjustmentStrategy("skip_insufficient")}
              disabled={applyingPointsAdjust}
              data-testid="points-tool-strategy-skip"
            >
              {tAdmin("pointsStrategySkipInsufficient")}
            </Button>
            <Button
              type="button"
              onClick={() => applyPointsAdjustmentStrategy("floor_zero")}
              disabled={applyingPointsAdjust}
              data-testid="points-tool-strategy-floor"
            >
              {tAdmin("pointsStrategyFloorToZero")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingSurvey}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSurvey(null);
            setSurveyVersions([]);
            setSelectedSurveyVersion(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tAdmin("editSurvey")}</DialogTitle>
            <DialogDescription>
              {tAdmin("editSurveyDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tAdmin("surveyTitle")}</Label>
              <Input
                value={surveyForm.title}
                onChange={(event) =>
                  setSurveyForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("surveyDescription")}</Label>
              <Input
                value={surveyForm.description}
                onChange={(event) =>
                  setSurveyForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{tAdmin("visibilityLabel")}</Label>
                <select
                  className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 w-full"
                  value={surveyForm.visibility}
                  onChange={(event) =>
                    setSurveyForm((prev) => ({
                      ...prev,
                      visibility: event.target.value,
                    }))
                  }
                >
                  <option value="public">{tAdmin("visibilityPublic")}</option>
                  <option value="non-public">
                    {tAdmin("visibilityNonPublic")}
                  </option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{tAdmin("pointsReward")}</Label>
                <Input
                  type="number"
                  value={surveyForm.pointsReward}
                  onChange={(event) =>
                    setSurveyForm((prev) => ({
                      ...prev,
                      pointsReward: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2 border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {tAdmin("responseStatus")}
                </p>
                <p className="text-xs text-gray-500">
                  {tAdmin("responseStatusHint")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={
                    editingSurvey?.currentPublishedVersionNumber
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-600"
                  }
                >
                  {editingSurvey?.currentPublishedVersionNumber
                    ? tAdmin("publishedVersion", {
                        version: editingSurvey.currentPublishedVersionNumber,
                      })
                    : tAdmin("notPublishedYet")}
                </Badge>
                <Badge
                  className={
                    editingSurvey?.isResponseOpen
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }
                >
                  {editingSurvey?.isResponseOpen
                    ? tCommon("openResponses")
                    : tCommon("closeResponses")}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={publishSurveyVersion}
                  disabled={publishingSurveyVersion || savingSurvey}
                >
                  {publishingSurveyVersion
                    ? tCommon("saving")
                    : tAdmin("publishNewVersion")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toggleSurveyResponses(
                      !(editingSurvey?.isResponseOpen ?? false),
                    )
                  }
                  disabled={
                    togglingSurveyResponses ||
                    !editingSurvey?.currentPublishedVersionNumber
                  }
                >
                  {togglingSurveyResponses
                    ? tCommon("saving")
                    : editingSurvey?.isResponseOpen
                      ? tCommon("closeResponses")
                      : tCommon("openResponses")}
                </Button>
              </div>
            </div>
            <div className="space-y-2 border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-3">
              <div className="text-sm font-medium">
                {tAdmin("surveyVersionsTitle")}
              </div>
              {surveyVersionsLoading ? (
                <p className="text-xs text-gray-500">{tCommon("loading")}</p>
              ) : surveyVersions.length === 0 ? (
                <p className="text-xs text-gray-500">
                  {tAdmin("surveyVersionsEmpty")}
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {surveyVersions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between rounded-md border border-gray-100 dark:border-gray-800 px-2 py-1.5"
                    >
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        {tAdmin("versionLabel", {
                          version: version.versionNumber,
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedSurveyVersion(version)}
                        >
                          {tAdmin("viewVersion")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            restoreSurveyDraft(version.versionNumber)
                          }
                          disabled={
                            restoringSurveyVersion === version.versionNumber
                          }
                        >
                          {restoringSurveyVersion === version.versionNumber
                            ? tCommon("saving")
                            : tAdmin("restoreToDraft")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {tAdmin("datasetSharing")}
                </p>
                <p className="text-xs text-gray-500">
                  {tAdmin("datasetSharingHint")}
                </p>
              </div>
              <Switch
                checked={surveyForm.includeInDatasets}
                onCheckedChange={(checked) =>
                  setSurveyForm((prev) => ({
                    ...prev,
                    includeInDatasets: checked,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSurvey(null)}>
              {tCommon("confirm")}
            </Button>
            <Button onClick={saveSurvey} disabled={savingSurvey}>
              {savingSurvey ? tCommon("saving") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingDataset}
        onOpenChange={(open) => {
          if (!open) {
            setEditingDataset(null);
            setDatasetVersions([]);
            setDatasetVersionUploadFile(null);
            if (datasetVersionFileInputRef.current) {
              datasetVersionFileInputRef.current.value = "";
            }
          }
        }}
      >
        <DialogContent
          className="grid-rows-[auto_minmax(0,1fr)_auto] max-h-[calc(100vh-2rem)] overflow-hidden sm:max-w-4xl"
          data-testid="dataset-edit-modal"
        >
          <DialogHeader>
            <DialogTitle>{tAdmin("editDataset")}</DialogTitle>
            <DialogDescription>
              {tAdmin("editDatasetDescription")}
            </DialogDescription>
          </DialogHeader>
          <div
            className="min-h-0 space-y-4 overflow-y-auto pr-1"
            data-testid="dataset-edit-modal-body"
          >
            <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {editingDataset?.currentPublishedVersionNumber
                      ? tAdmin("publishedVersion", {
                          version: editingDataset.currentPublishedVersionNumber,
                        })
                      : tAdmin("notPublishedYet")}
                  </p>
                  <p className="text-xs text-gray-500">
                    {editingDataset?.hasUnpublishedChanges
                      ? tAdmin("datasetUnpublishedChanges")
                      : tAdmin("datasetNoUnpublishedChanges")}
                  </p>
                </div>
                <Button
                  onClick={publishDatasetVersion}
                  disabled={publishingDatasetVersion || savingDataset}
                >
                  {publishingDatasetVersion
                    ? tCommon("saving")
                    : tAdmin("publishNewVersion")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tAdmin("datasetFile")}</Label>
              <Input
                ref={datasetVersionFileInputRef}
                type="file"
                data-testid="dataset-version-file-input"
                onChange={(event) =>
                  setDatasetVersionUploadFile(event.target.files?.[0] ?? null)
                }
              />
              {datasetVersionUploadFile ? (
                <div
                  className="flex items-center justify-between rounded-md border border-gray-100 px-2 py-1.5 text-xs dark:border-gray-800"
                  data-testid="dataset-version-file-selection"
                >
                  <span className="truncate pr-2">
                    {`${datasetVersionUploadFile.name} (${datasetVersionUploadFile.size.toLocaleString()})`}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDatasetVersionUploadFile(null);
                      if (datasetVersionFileInputRef.current) {
                        datasetVersionFileInputRef.current.value = "";
                      }
                    }}
                  >
                    {tCommon("delete")}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>{tAdmin("datasetTitle")}</Label>
              <Input
                value={datasetForm.title}
                onChange={(event) =>
                  setDatasetForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("datasetDescription")}</Label>
              <Input
                value={datasetForm.description}
                onChange={(event) =>
                  setDatasetForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{tAdmin("datasetCategory")}</Label>
                <Input
                  value={datasetForm.category}
                  onChange={(event) =>
                    setDatasetForm((prev) => ({
                      ...prev,
                      category: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tAdmin("accessType")}</Label>
                <select
                  className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 w-full"
                  value={datasetForm.accessType}
                  onChange={(event) =>
                    setDatasetForm((prev) => ({
                      ...prev,
                      accessType: event.target.value,
                    }))
                  }
                >
                  <option value="free">{tAdmin("accessFree")}</option>
                  <option value="paid">{tAdmin("accessPaid")}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{tAdmin("datasetPrice")}</Label>
                <Input
                  type="number"
                  value={datasetForm.price}
                  onChange={(event) =>
                    setDatasetForm((prev) => ({
                      ...prev,
                      price: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tAdmin("datasetSamples")}</Label>
                <Input
                  type="number"
                  value={datasetForm.sampleSize}
                  onChange={(event) =>
                    setDatasetForm((prev) => ({
                      ...prev,
                      sampleSize: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("entitlementPolicyLabel")}</Label>
              <select
                className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 w-full"
                value={datasetForm.entitlementPolicy}
                onChange={(event) =>
                  setDatasetForm((prev) => ({
                    ...prev,
                    entitlementPolicy:
                      event.target.value === "all_versions_if_any_purchase"
                        ? "all_versions_if_any_purchase"
                        : "purchased_only",
                  }))
                }
              >
                <option value="purchased_only">
                  {tAdmin("entitlementPurchasedOnly")}
                </option>
                <option value="all_versions_if_any_purchase">
                  {tAdmin("entitlementAllVersions")}
                </option>
              </select>
              <p className="text-xs text-gray-500">
                {tAdmin("entitlementPolicyHint")}
              </p>
            </div>
            <div className="flex items-center justify-between border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">{tAdmin("datasetActive")}</p>
                <p className="text-xs text-gray-500">
                  {tAdmin("datasetActiveHint")}
                </p>
              </div>
              <Switch
                checked={datasetForm.isActive}
                onCheckedChange={(checked) =>
                  setDatasetForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {tAdmin("datasetVersionHistoryTitle")}
              </p>
              {datasetVersionsLoading ? (
                <p className="text-xs text-gray-500">{tCommon("loading")}</p>
              ) : datasetVersions.length === 0 ? (
                <p className="text-xs text-gray-500">
                  {tAdmin("datasetVersionHistoryEmpty")}
                </p>
              ) : (
                <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-gray-100 p-2 dark:border-gray-800">
                  {datasetVersions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between rounded-md border border-gray-100 px-2 py-1.5 text-xs dark:border-gray-800"
                    >
                      <div className="space-y-0.5">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {tAdmin("versionLabel", { version: version.versionNumber })}
                        </p>
                        <p className="text-gray-500">
                          {version.accessType === "paid"
                            ? tAdmin("datasetVersionPaidLabel", {
                                price: version.price,
                              })
                            : tAdmin("datasetVersionFreeLabel")}
                        </p>
                      </div>
                      <div className="text-right text-gray-500">
                        <p>{tAdmin("adminDownloadsLabel", { count: version.downloadCount })}</p>
                        <p>{tAdmin("adminSamplesLabel", { count: version.sampleSize })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter
            className="border-t border-gray-100 pt-2 dark:border-gray-800"
            data-testid="dataset-edit-modal-footer"
          >
            <Button
              variant="outline"
              onClick={() => {
                setEditingDataset(null);
                setDatasetVersionUploadFile(null);
                if (datasetVersionFileInputRef.current) {
                  datasetVersionFileInputRef.current.value = "";
                }
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={saveDataset} disabled={savingDataset}>
              {savingDataset ? tCommon("saving") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedSurveyVersion}
        onOpenChange={(open) => !open && setSelectedSurveyVersion(null)}
      >
        <DialogContent className="max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedSurveyVersion
                ? tAdmin("versionPreviewTitle", {
                    version: selectedSurveyVersion.versionNumber,
                  })
                : tAdmin("versionPreviewTitle", { version: 0 })}
            </DialogTitle>
            <DialogDescription>
              {tAdmin("versionPreviewDescription")}
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-gray-50 dark:bg-gray-900 p-3 text-xs">
            {selectedSurveyVersion
              ? JSON.stringify(selectedSurveyVersion.snapshot, null, 2)
              : ""}
          </pre>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedSurveyVersion(null)}
            >
              {tCommon("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={agentDialogOpen}
        onOpenChange={(open) => !open && closeAgentDialog()}
      >
        <DialogContent className="max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAgent ? tAdmin("editAgent") : tAdmin("createAgent")}
            </DialogTitle>
            <DialogDescription>
              {tAdmin("agentDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tAdmin("agentOwnerUserId")}</Label>
              <select
                className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 w-full"
                value={agentForm.ownerUserId}
                onChange={(event) =>
                  setAgentForm((prev) => ({
                    ...prev,
                    ownerUserId: event.target.value,
                  }))
                }
                disabled={!currentUser?.isSuperAdmin}
              >
                {availableAgentOwners.length === 0 ? (
                  <option value="">
                    {tAdmin("agentOwnerUserIdPlaceholder")}
                  </option>
                ) : null}
                {availableAgentOwners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                {currentUser?.isSuperAdmin
                  ? tAdmin("agentOwnerEditable")
                  : tAdmin("agentOwnerLocked")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("agentName")}</Label>
              <Input
                value={agentForm.name}
                onChange={(event) =>
                  setAgentForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder={tAdmin("agentNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("agentDescription")}</Label>
              <Input
                value={agentForm.description}
                onChange={(event) =>
                  setAgentForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder={tAdmin("agentDescriptionPlaceholder")}
              />
            </div>
            <div className="flex items-center justify-between border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">{tAdmin("agentActive")}</p>
                <p className="text-xs text-gray-500">
                  {tAdmin("agentActiveHint")}
                </p>
              </div>
              <Switch
                checked={agentForm.isActive}
                onCheckedChange={(checked) =>
                  setAgentForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("agentPermissions")}</Label>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {AGENT_PERMISSIONS.map((permission) => {
                  const checked = agentForm.permissions.includes(permission);
                  return (
                    <label
                      key={permission}
                      className="flex items-start justify-between gap-3 rounded-md border border-gray-100 dark:border-gray-800 px-3 py-3"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {permission}
                        </div>
                        <p className="text-xs text-gray-500">
                          {tAdmin(
                            AGENT_PERMISSION_DESCRIPTION_KEYS[permission],
                          )}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={(event) =>
                          toggleAgentPermission(
                            permission,
                            event.target.checked,
                          )
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAgentDialog}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={saveAgentAccount}
              disabled={savingAgentId === (editingAgent?.id || "new")}
            >
              {savingAgentId === (editingAgent?.id || "new")
                ? tCommon("saving")
                : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rotateConfirmAgent)}
        onOpenChange={(open) => {
          if (!open) {
            closeRotateAgentKeyDialog();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tAdmin("agentRotateKeyConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {tAdmin("agentRotateKeyConfirmDescription", {
                name: rotateConfirmAgent?.name || "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeRotateAgentKeyDialog}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={() => rotateConfirmAgent && void rotateAgentKey(rotateConfirmAgent)}
              disabled={savingAgentId === rotateConfirmAgent?.id}
            >
              {savingAgentId === rotateConfirmAgent?.id
                ? tCommon("saving")
                : tAdmin("rotateAgentKey")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(revealedAgentKey && keyDialogAgent)}
        onOpenChange={(open) => {
          if (!open) {
            setKeyDialogAgent(null);
            setRevealedAgentKey(null);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{tAdmin("agentKeyLabel")}</DialogTitle>
            <DialogDescription>
              {tAdmin("agentKeyDialogDescription", {
                name: keyDialogAgent?.name || "",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
            <code className="block break-all rounded bg-white px-3 py-2 text-xs text-amber-900">
              {revealedAgentKey}
            </code>
            <p className="text-xs text-amber-800">{tAdmin("agentKeyHint")}</p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setKeyDialogAgent(null);
                setRevealedAgentKey(null);
              }}
            >
              {tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tAdmin("uploadDataset")}</DialogTitle>
            <DialogDescription>
              {tAdmin("uploadDatasetDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tAdmin("surveyId")}</Label>
              <Input
                value={uploadForm.surveyId}
                onChange={(event) =>
                  setUploadForm((prev) => ({
                    ...prev,
                    surveyId: event.target.value,
                  }))
                }
                placeholder={tAdmin("surveyIdPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("datasetTitle")}</Label>
              <Input
                value={uploadForm.title}
                onChange={(event) =>
                  setUploadForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("datasetDescription")}</Label>
              <Input
                value={uploadForm.description}
                onChange={(event) =>
                  setUploadForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{tAdmin("datasetCategory")}</Label>
                <Input
                  value={uploadForm.category}
                  onChange={(event) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      category: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tAdmin("accessType")}</Label>
                <select
                  className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 w-full"
                  value={uploadForm.accessType}
                  onChange={(event) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      accessType: event.target.value,
                    }))
                  }
                >
                  <option value="free">{tAdmin("accessFree")}</option>
                  <option value="paid">{tAdmin("accessPaid")}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{tAdmin("datasetPrice")}</Label>
                <Input
                  type="number"
                  value={uploadForm.price}
                  onChange={(event) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      price: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tAdmin("datasetSamples")}</Label>
                <Input
                  type="number"
                  value={uploadForm.sampleSize}
                  onChange={(event) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      sampleSize: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("datasetFile")}</Label>
              <Input
                type="file"
                onChange={(event) =>
                  setUploadFile(event.target.files?.[0] ?? null)
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={uploadDataset} disabled={uploadingDataset}>
              {uploadingDataset ? tCommon("saving") : tAdmin("uploadAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
