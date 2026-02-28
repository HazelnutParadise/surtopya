"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslations } from "next-intl"
import type {
  AdminUser,
  Capability,
  Dataset,
  MembershipTier,
  PolicyMatrixEntry,
  PolicyWriter,
  Survey,
  UserProfile,
} from "@/lib/api"

const PAGE_SIZE = 20

export default function AdminPage() {
  const tAdmin = useTranslations("Admin")
  const tCommon = useTranslations("Common")

  const [surveys, setSurveys] = useState<Survey[]>([])
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [surveySearch, setSurveySearch] = useState("")
  const [datasetSearch, setDatasetSearch] = useState("")
  const [surveyVisibility, setSurveyVisibility] = useState("all")
  const [surveyPublished, setSurveyPublished] = useState("all")
  const [datasetActive, setDatasetActive] = useState("all")
  const [surveyLoading, setSurveyLoading] = useState(true)
  const [datasetLoading, setDatasetLoading] = useState(true)
  const [userLoading, setUserLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userSearch, setUserSearch] = useState("")
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [policyLoading, setPolicyLoading] = useState(true)
  const [policySaving, setPolicySaving] = useState(false)
  const [tiers, setTiers] = useState<MembershipTier[]>([])
  const [capabilities, setCapabilities] = useState<Capability[]>([])
  const [matrix, setMatrix] = useState<PolicyMatrixEntry[]>([])
  const [policyWriters, setPolicyWriters] = useState<PolicyWriter[]>([])
  const [savingPolicyWriterId, setSavingPolicyWriterId] = useState<string | null>(null)
  const [membershipDrafts, setMembershipDrafts] = useState<
    Record<string, { membershipTier: string; membershipIsPermanent: boolean; membershipPeriodEndAt: string }>
  >({})
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null)
  const [savingCapabilityId, setSavingCapabilityId] = useState<string | null>(null)
  const [newPlan, setNewPlan] = useState({
    code: "",
    nameI18n: { "zh-TW": "", en: "", ja: "" } as Record<string, string>,
    descriptionI18n: { "zh-TW": "", en: "", ja: "" } as Record<string, string>,
    isActive: true,
    isPurchasable: false,
    showOnPricing: false,
    priceCentsUsd: 0,
    billingInterval: "month",
    allowRenewalForExisting: false,
  })

  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null)
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null)
  const [surveyForm, setSurveyForm] = useState({
    title: "",
    description: "",
    visibility: "non-public",
    includeInDatasets: false,
    isPublished: false,
    pointsReward: 0,
  })
  const [datasetForm, setDatasetForm] = useState({
    title: "",
    description: "",
    category: "",
    accessType: "free",
    price: 0,
    sampleSize: 0,
    isActive: true,
  })
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    surveyId: "",
    title: "",
    description: "",
    category: "other",
    accessType: "free",
    price: 0,
    sampleSize: 0,
  })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadingDataset, setUploadingDataset] = useState(false)
  const [savingSurvey, setSavingSurvey] = useState(false)
  const [savingDataset, setSavingDataset] = useState(false)

  useEffect(() => {
    let isMounted = true
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" })
        if (!response.ok) {
          return
        }
        const payload = await response.json()
        if (isMounted) {
          setCurrentUser(payload)
        }
      } catch {
        // ignore
      }
    }

    const loadSurveys = async () => {
      setSurveyLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (surveySearch) params.set("search", surveySearch)
        if (surveyVisibility !== "all") params.set("visibility", surveyVisibility)
        if (surveyPublished !== "all") params.set("published", surveyPublished)
        params.set("limit", PAGE_SIZE.toString())
        params.set("offset", "0")

        const response = await fetch(`/api/admin/surveys?${params.toString()}`, { cache: "no-store" })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.error || "Failed to load surveys")
        }
        const payload = await response.json()
        if (isMounted) {
          setSurveys(payload.surveys || [])
        }
      } catch (err) {
        if (isMounted) {
          setError(tAdmin("loadError"))
          setSurveys([])
        }
      } finally {
        if (isMounted) {
          setSurveyLoading(false)
        }
      }
    }

    loadProfile()
    loadSurveys()
    return () => {
      isMounted = false
    }
  }, [surveySearch, surveyVisibility, surveyPublished, tAdmin])

  useEffect(() => {
    let isMounted = true
    const loadDatasets = async () => {
      setDatasetLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (datasetSearch) params.set("search", datasetSearch)
        if (datasetActive !== "all") params.set("active", datasetActive)
        params.set("limit", PAGE_SIZE.toString())
        params.set("offset", "0")

        const response = await fetch(`/api/admin/datasets?${params.toString()}`, { cache: "no-store" })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.error || "Failed to load datasets")
        }
        const payload = await response.json()
        if (isMounted) {
          setDatasets(payload.datasets || [])
        }
      } catch (err) {
        if (isMounted) {
          setError(tAdmin("loadError"))
          setDatasets([])
        }
      } finally {
        if (isMounted) {
          setDatasetLoading(false)
        }
      }
    }

    loadDatasets()
    return () => {
      isMounted = false
    }
  }, [datasetSearch, datasetActive, tAdmin])

  useEffect(() => {
    let isMounted = true
    const loadUsers = async () => {
      setUserLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (userSearch) params.set("search", userSearch)
        params.set("limit", PAGE_SIZE.toString())
        params.set("offset", "0")

        const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.error || "Failed to load users")
        }
        const payload = await response.json()
        if (isMounted) {
          setUsers(payload.users || [])
        }
      } catch (err) {
        if (isMounted) {
          setError(tAdmin("loadError"))
          setUsers([])
        }
      } finally {
        if (isMounted) {
          setUserLoading(false)
        }
      }
    }

    loadUsers()
    return () => {
      isMounted = false
    }
  }, [userSearch, tAdmin])

  useEffect(() => {
    setMembershipDrafts((prev) => {
      const next = { ...prev }
      for (const user of users) {
        next[user.id] = next[user.id] || {
          membershipTier: user.membershipTier,
          membershipIsPermanent: user.membershipIsPermanent ?? true,
          membershipPeriodEndAt: user.membershipPeriodEndAt ? user.membershipPeriodEndAt.slice(0, 10) : "",
        }
      }
      return next
    })
  }, [users])

  useEffect(() => {
    let isMounted = true

    const loadPolicies = async () => {
      setPolicyLoading(true)
      setError(null)
      try {
        const [policiesRes, writersRes] = await Promise.all([
          fetch("/api/admin/policies", { cache: "no-store" }),
          fetch("/api/admin/policy-writers", { cache: "no-store" }),
        ])

        if (!policiesRes.ok) {
          const payload = await policiesRes.json().catch(() => ({}))
          throw new Error(payload?.error || "Failed to load policies")
        }
        if (!writersRes.ok) {
          const payload = await writersRes.json().catch(() => ({}))
          throw new Error(payload?.error || "Failed to load policy writers")
        }

        const policiesPayload = await policiesRes.json()
        const writersPayload = await writersRes.json()

        if (isMounted) {
          setTiers(policiesPayload.tiers || [])
          setCapabilities(policiesPayload.capabilities || [])
          setMatrix(policiesPayload.matrix || [])
          setPolicyWriters(writersPayload.users || [])
        }
      } catch {
        if (isMounted) {
          setError(tAdmin("loadError"))
          setTiers([])
          setCapabilities([])
          setMatrix([])
          setPolicyWriters([])
        }
      } finally {
        if (isMounted) {
          setPolicyLoading(false)
        }
      }
    }

    loadPolicies()
    return () => {
      isMounted = false
    }
  }, [tAdmin])

  const openSurveyEditor = (survey: Survey) => {
    setEditingSurvey(survey)
    setSurveyForm({
      title: survey.title,
      description: survey.description || "",
      visibility: survey.visibility,
      includeInDatasets: survey.includeInDatasets,
      isPublished: survey.isPublished,
      pointsReward: survey.pointsReward,
    })
  }

  const openDatasetEditor = (dataset: Dataset) => {
    setEditingDataset(dataset)
    setDatasetForm({
      title: dataset.title,
      description: dataset.description || "",
      category: dataset.category,
      accessType: dataset.accessType,
      price: dataset.price,
      sampleSize: dataset.sampleSize,
      isActive: dataset.isActive,
    })
  }

  const saveSurvey = async () => {
    if (!editingSurvey) return
    setSavingSurvey(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/surveys/${editingSurvey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: surveyForm.title,
          description: surveyForm.description,
          visibility: surveyForm.visibility,
          includeInDatasets: surveyForm.includeInDatasets,
          isPublished: surveyForm.isPublished,
          pointsReward: surveyForm.pointsReward,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Failed to update survey")
      }
      const payload = await response.json()
      setSurveys((prev) => prev.map((survey) => (survey.id === payload.id ? payload : survey)))
      setEditingSurvey(null)
    } catch (err) {
      setError(tAdmin("updateError"))
    } finally {
      setSavingSurvey(false)
    }
  }

  const saveDataset = async () => {
    if (!editingDataset) return
    setSavingDataset(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/datasets/${editingDataset.id}`, {
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
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Failed to update dataset")
      }
      const payload = await response.json()
      setDatasets((prev) => prev.map((dataset) => (dataset.id === payload.id ? payload : dataset)))
      setEditingDataset(null)
    } catch (err) {
      setError(tAdmin("updateError"))
    } finally {
      setSavingDataset(false)
    }
  }

  const uploadDataset = async () => {
    if (!uploadFile) {
      setError(tAdmin("datasetFileRequired"))
      return
    }
    setUploadingDataset(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("surveyId", uploadForm.surveyId)
      formData.append("title", uploadForm.title)
      formData.append("description", uploadForm.description)
      formData.append("category", uploadForm.category)
      formData.append("accessType", uploadForm.accessType)
      formData.append("price", String(uploadForm.price))
      formData.append("sampleSize", String(uploadForm.sampleSize))
      formData.append("file", uploadFile)

      const response = await fetch("/api/admin/datasets", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Upload failed")
      }
      const payload = await response.json()
      setDatasets((prev) => [payload, ...prev])
      setUploadDialogOpen(false)
      setUploadForm({
        surveyId: "",
        title: "",
        description: "",
        category: "other",
        accessType: "free",
        price: 0,
        sampleSize: 0,
      })
      setUploadFile(null)
    } catch (err) {
      setError(tAdmin("uploadError"))
    } finally {
      setUploadingDataset(false)
    }
  }

  const deleteSurvey = async (survey: Survey) => {
    if (!window.confirm(tAdmin("deleteSurveyConfirm"))) return
    try {
      const response = await fetch(`/api/admin/surveys/${survey.id}`, { method: "DELETE" })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Delete failed")
      }
      setSurveys((prev) => prev.filter((item) => item.id !== survey.id))
    } catch (err) {
      setError(tAdmin("deleteError"))
    }
  }

  const deleteDataset = async (dataset: Dataset) => {
    if (!window.confirm(tAdmin("deleteDatasetConfirm"))) return
    try {
      const response = await fetch(`/api/admin/datasets/${dataset.id}`, { method: "DELETE" })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Delete failed")
      }
      setDatasets((prev) => prev.filter((item) => item.id !== dataset.id))
    } catch (err) {
      setError(tAdmin("deleteError"))
    }
  }

  const toggleAdmin = async (user: AdminUser, nextValue: boolean) => {
    if (!currentUser?.isSuperAdmin) return
    setSavingUserId(user.id)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: nextValue }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Update failed")
      }
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...item, isAdmin: nextValue || item.isSuperAdmin } : item
        )
      )
    } catch (err) {
      setError(tAdmin("updateError"))
    } finally {
      setSavingUserId(null)
    }
  }

  const patchMembershipDraft = (
    userId: string,
    patch: Partial<{ membershipTier: string; membershipIsPermanent: boolean; membershipPeriodEndAt: string }>
  ) => {
    setMembershipDrafts((prev) => {
      const current = prev[userId] || {
        membershipTier: "free",
        membershipIsPermanent: true,
        membershipPeriodEndAt: "",
      }
      return {
        ...prev,
        [userId]: {
          ...current,
          ...patch,
        },
      }
    })
  }

  const saveMembershipGrant = async (user: AdminUser) => {
    const draft = membershipDrafts[user.id]
    if (!draft) return
    setSavingUserId(user.id)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipTier: draft.membershipTier,
          membershipIsPermanent: draft.membershipIsPermanent,
          membershipPeriodEndAt: draft.membershipIsPermanent ? "" : draft.membershipPeriodEndAt,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Update failed")
      }
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? {
                ...item,
                membershipTier: draft.membershipTier,
                membershipIsPermanent: draft.membershipIsPermanent,
                membershipPeriodEndAt: draft.membershipIsPermanent
                  ? undefined
                  : draft.membershipPeriodEndAt,
              }
            : item
        )
      )
    } catch {
      setError(tAdmin("updateError"))
    } finally {
      setSavingUserId(null)
    }
  }

  const policyMatrixValue = (tierCode: string, capabilityKey: string) =>
    matrix.find(
      (entry) =>
        entry.tierCode === tierCode && entry.capabilityKey === capabilityKey
    )?.isAllowed ?? false

  const updatePolicyMatrixValue = (
    tierCode: string,
    capabilityKey: string,
    isAllowed: boolean
  ) => {
    setMatrix((prev) => {
      const index = prev.findIndex(
        (entry) =>
          entry.tierCode === tierCode && entry.capabilityKey === capabilityKey
      )
      if (index === -1) {
        return [...prev, { tierCode, capabilityKey, isAllowed }]
      }
      const next = [...prev]
      next[index] = { ...next[index], isAllowed }
      return next
    })
  }

  const savePolicies = async () => {
    setPolicySaving(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/policies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: matrix }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Update failed")
      }
    } catch {
      setError(tAdmin("updateError"))
    } finally {
      setPolicySaving(false)
    }
  }

  const savePlan = async (plan: MembershipTier) => {
    setSavingPlanId(plan.id)
    setError(null)
    try {
      const response = await fetch(`/api/admin/subscription-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameI18n: plan.nameI18n,
          descriptionI18n: plan.descriptionI18n,
          isActive: plan.isActive,
          isPurchasable: plan.isPurchasable,
          showOnPricing: plan.showOnPricing,
          priceCentsUsd: plan.priceCentsUsd,
          billingInterval: plan.billingInterval || "month",
          allowRenewalForExisting: plan.allowRenewalForExisting,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Update failed")
      }
      const payload = await response.json()
      setTiers((prev) => prev.map((item) => (item.id === plan.id ? payload : item)))
    } catch {
      setError(tAdmin("updateError"))
    } finally {
      setSavingPlanId(null)
    }
  }

  const createPlan = async () => {
    setCreatingPlan(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/subscription-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlan),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Create failed")
      }
      const payload = await response.json()
      setTiers((prev) => [...prev, payload])
      setNewPlan({
        code: "",
        nameI18n: { "zh-TW": "", en: "", ja: "" },
        descriptionI18n: { "zh-TW": "", en: "", ja: "" },
        isActive: true,
        isPurchasable: false,
        showOnPricing: false,
        priceCentsUsd: 0,
        billingInterval: "month",
        allowRenewalForExisting: false,
      })
    } catch {
      setError(tAdmin("updateError"))
    } finally {
      setCreatingPlan(false)
    }
  }

  const saveCapability = async (capability: Capability) => {
    setSavingCapabilityId(capability.id)
    setError(null)
    try {
      const response = await fetch(`/api/admin/capabilities/${capability.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameI18n: capability.nameI18n,
          descriptionI18n: capability.descriptionI18n,
          showOnPricing: capability.showOnPricing,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Update failed")
      }
      const payload = await response.json()
      setCapabilities((prev) => prev.map((item) => (item.id === capability.id ? payload : item)))
    } catch {
      setError(tAdmin("updateError"))
    } finally {
      setSavingCapabilityId(null)
    }
  }

  const setPolicyWriter = async (userId: string, enabled: boolean) => {
    setSavingPolicyWriterId(userId)
    setError(null)
    try {
      const response = await fetch(`/api/admin/policy-writers/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Update failed")
      }
      setPolicyWriters((prev) =>
        prev.map((item) =>
          item.id === userId ? { ...item, canWritePolicy: enabled || item.isSuperAdmin } : item
        )
      )
    } catch {
      setError(tAdmin("updateError"))
    } finally {
      setSavingPolicyWriterId(null)
    }
  }

  const surveyCountLabel = useMemo(() => tAdmin("surveyCount", { count: surveys.length }), [surveys.length, tAdmin])
  const datasetCountLabel = useMemo(() => tAdmin("datasetCount", { count: datasets.length }), [datasets.length, tAdmin])
  const adminCountLabel = useMemo(() => tAdmin("adminCount", { count: users.length }), [users.length, tAdmin])
  const policyWriterCountLabel = useMemo(
    () => tAdmin("policyWriterCount", { count: policyWriters.length }),
    [policyWriters.length, tAdmin]
  )
  const canWritePolicies = useMemo(() => {
    if (!currentUser) return false
    if (currentUser.isSuperAdmin) return true
    return policyWriters.some((writer) => writer.id === currentUser.id && writer.canWritePolicy)
  }, [currentUser, policyWriters])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      <div className="container px-4 py-10 md:px-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tAdmin("title")}</h1>
          <p className="text-gray-500 dark:text-gray-400">{tAdmin("description")}</p>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <Tabs defaultValue="surveys">
          <TabsList>
            <TabsTrigger value="surveys">{tAdmin("surveysTab")}</TabsTrigger>
            <TabsTrigger value="datasets">{tAdmin("datasetsTab")}</TabsTrigger>
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
                      onChange={(event) => setSurveyVisibility(event.target.value)}
                    >
                      <option value="all">{tAdmin("visibilityAll")}</option>
                      <option value="public">{tAdmin("visibilityPublic")}</option>
                      <option value="non-public">{tAdmin("visibilityNonPublic")}</option>
                    </select>
                    <select
                      className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900"
                      value={surveyPublished}
                      onChange={(event) => setSurveyPublished(event.target.value)}
                    >
                      <option value="all">{tAdmin("publishedAll")}</option>
                      <option value="true">{tAdmin("publishedOnly")}</option>
                      <option value="false">{tAdmin("draftOnly")}</option>
                    </select>
                  </div>
                </div>

                {surveyLoading ? (
                  <div className="text-sm text-gray-500">{tCommon("loading")}</div>
                ) : surveys.length === 0 ? (
                  <div className="text-sm text-gray-500">{tAdmin("noSurveys")}</div>
                ) : (
                  <div className="space-y-3">
                    {surveys.map((survey) => (
                      <div key={survey.id} className="flex flex-col gap-3 border border-gray-100 dark:border-gray-800 rounded-lg p-4 bg-white/70 dark:bg-gray-900/70">
                        {(() => {
                          const visibilityLabel =
                            survey.visibility === "public" ? tAdmin("visibilityPublic") : tAdmin("visibilityNonPublic")
                          return (
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{survey.title}</h3>
                              <Badge variant="secondary">{visibilityLabel}</Badge>
                              <Badge className={survey.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}>
                                {survey.isPublished ? tAdmin("published") : tAdmin("draft")}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500 line-clamp-2">{survey.description}</p>
                            <div className="text-xs text-gray-400">
                              {tAdmin("surveyMeta", { responses: survey.responseCount, points: survey.pointsReward })}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => openSurveyEditor(survey)}>
                              {tCommon("edit")}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => deleteSurvey(survey)}>
                              {tCommon("delete")}
                            </Button>
                          </div>
                        </div>
                          )
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
                    <Button onClick={() => setUploadDialogOpen(true)}>{tAdmin("uploadDataset")}</Button>
                  </div>
                </div>

                {datasetLoading ? (
                  <div className="text-sm text-gray-500">{tCommon("loading")}</div>
                ) : datasets.length === 0 ? (
                  <div className="text-sm text-gray-500">{tAdmin("noDatasets")}</div>
                ) : (
                  <div className="space-y-3">
                    {datasets.map((dataset) => (
                      <div key={dataset.id} className="flex flex-col gap-3 border border-gray-100 dark:border-gray-800 rounded-lg p-4 bg-white/70 dark:bg-gray-900/70">
                        {(() => {
                          const accessLabel =
                            dataset.accessType === "paid" ? tAdmin("accessPaid") : tAdmin("accessFree")
                          return (
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{dataset.title}</h3>
                              <Badge variant="secondary">{dataset.category}</Badge>
                              <Badge className={dataset.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}>
                                {dataset.isActive ? tAdmin("active") : tAdmin("inactive")}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500 line-clamp-2">{dataset.description}</p>
                            <div className="text-xs text-gray-400">
                              {tAdmin("datasetMeta", { access: accessLabel, samples: dataset.sampleSize })}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => openDatasetEditor(dataset)}>
                              {tCommon("edit")}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => deleteDataset(dataset)}>
                              {tCommon("delete")}
                            </Button>
                          </div>
                        </div>
                          )
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admins" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{tAdmin("adminsTitle")}</CardTitle>
                <CardDescription>{adminCountLabel}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <Input
                    placeholder={tAdmin("searchAdmins")}
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    className="md:max-w-sm"
                  />
                  {!currentUser?.isSuperAdmin && (
                    <div className="text-xs text-gray-500">{tAdmin("superAdminOnlyHint")}</div>
                  )}
                </div>

                {userLoading ? (
                  <div className="text-sm text-gray-500">{tCommon("loading")}</div>
                ) : users.length === 0 ? (
                  <div className="text-sm text-gray-500">{tAdmin("noAdmins")}</div>
                ) : (
                  <div className="space-y-3">
                    {users.map((user) => {
                      const label = user.displayName || user.email || user.id
                      return (
                        <div key={user.id} className="flex flex-col gap-3 border border-gray-100 dark:border-gray-800 rounded-lg p-4 bg-white/70 dark:bg-gray-900/70">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{label}</h3>
                                {user.isSuperAdmin && (
                                  <Badge className="bg-purple-100 text-purple-700">{tAdmin("superAdmin")}</Badge>
                                )}
                                {user.isAdmin && !user.isSuperAdmin && (
                                  <Badge variant="secondary">{tAdmin("admin")}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500">{tAdmin("membershipTierLabel")}</span>
                                <div className="flex flex-wrap bg-gray-100 dark:bg-gray-800 rounded-md p-1 gap-1">
                                  {tiers.map((tier) => {
                                    const draft = membershipDrafts[user.id]
                                    const selectedTier = draft?.membershipTier || user.membershipTier
                                    return (
                                      <button
                                        key={`${user.id}-${tier.code}`}
                                        type="button"
                                        className={`px-3 py-1 text-xs rounded ${
                                          selectedTier === tier.code
                                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            : "text-gray-500"
                                        }`}
                                        disabled={!currentUser?.isSuperAdmin || savingUserId === user.id}
                                        onClick={() => patchMembershipDraft(user.id, { membershipTier: tier.code })}
                                        data-testid={`admin-tier-${tier.code}-${user.id}`}
                                      >
                                        {tier.code}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs text-gray-500">Permanent</span>
                                <Switch
                                  checked={membershipDrafts[user.id]?.membershipIsPermanent ?? user.membershipIsPermanent ?? true}
                                  onCheckedChange={(checked) =>
                                    patchMembershipDraft(user.id, {
                                      membershipIsPermanent: checked,
                                      membershipPeriodEndAt: checked
                                        ? ""
                                        : membershipDrafts[user.id]?.membershipPeriodEndAt || "",
                                    })
                                  }
                                  disabled={!currentUser?.isSuperAdmin || savingUserId === user.id}
                                  data-testid={`admin-membership-permanent-${user.id}`}
                                />
                                <Input
                                  type="date"
                                  value={membershipDrafts[user.id]?.membershipPeriodEndAt || ""}
                                  onChange={(event) =>
                                    patchMembershipDraft(user.id, { membershipPeriodEndAt: event.target.value })
                                  }
                                  disabled={
                                    !currentUser?.isSuperAdmin ||
                                    savingUserId === user.id ||
                                    (membershipDrafts[user.id]?.membershipIsPermanent ?? user.membershipIsPermanent ?? true)
                                  }
                                  className="w-44"
                                  data-testid={`admin-membership-end-at-${user.id}`}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => saveMembershipGrant(user)}
                                  disabled={!currentUser?.isSuperAdmin || savingUserId === user.id}
                                  data-testid={`admin-membership-save-${user.id}`}
                                >
                                  {savingUserId === user.id ? tCommon("saving") : tCommon("save")}
                                </Button>
                              </div>
                              <span className="text-xs text-gray-500">{tAdmin("adminToggleLabel")}</span>
                              <Switch
                                checked={user.isAdmin}
                                onCheckedChange={(checked) => toggleAdmin(user, checked)}
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
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>{tAdmin("policiesTitle")}</CardTitle>
                    <CardDescription>{policyWriterCountLabel}</CardDescription>
                  </div>
                  <Button onClick={savePolicies} disabled={!canWritePolicies || policySaving}>
                    {policySaving ? tCommon("saving") : tCommon("save")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {policyLoading ? (
                  <div className="text-sm text-gray-500">{tCommon("loading")}</div>
                ) : tiers.length === 0 || capabilities.length === 0 ? (
                  <div className="text-sm text-gray-500">{tAdmin("noPolicies")}</div>
                ) : (
                  <div className="overflow-auto border border-gray-100 dark:border-gray-800 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900/60">
                        <tr>
                          <th className="text-left px-3 py-2">{tAdmin("capabilityLabel")}</th>
                          {tiers.map((tier) => (
                            <th key={tier.code} className="text-left px-3 py-2">
                              {tier.code}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {capabilities.map((capability) => (
                          <tr key={capability.key} className="border-t border-gray-100 dark:border-gray-800">
                            <td className="px-3 py-2">
                              <div className="font-medium">{capability.key}</div>
                              <div className="text-xs text-gray-500">{capability.description}</div>
                            </td>
                            {tiers.map((tier) => (
                              <td key={`${capability.key}-${tier.code}`} className="px-3 py-2">
                                <Switch
                                  checked={policyMatrixValue(tier.code, capability.key)}
                                  onCheckedChange={(checked) =>
                                    updatePolicyMatrixValue(tier.code, capability.key, checked)
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

                <div className="space-y-3">
                  <div className="text-sm font-medium">Subscription Plans</div>
                  <div className="grid grid-cols-1 gap-3">
                    {tiers.map((tier) => (
                      <div key={tier.id} className="border border-gray-100 dark:border-gray-800 rounded-lg p-3 space-y-3">
                        <div className="text-sm font-medium">{tier.code}</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <Input
                            value={tier.nameI18n?.["zh-TW"] || ""}
                            onChange={(event) =>
                              setTiers((prev) =>
                                prev.map((item) =>
                                  item.id === tier.id
                                    ? {
                                        ...item,
                                        nameI18n: { ...(item.nameI18n || {}), "zh-TW": event.target.value },
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="name zh-TW"
                            disabled={!canWritePolicies}
                          />
                          <Input
                            value={tier.nameI18n?.en || ""}
                            onChange={(event) =>
                              setTiers((prev) =>
                                prev.map((item) =>
                                  item.id === tier.id
                                    ? {
                                        ...item,
                                        nameI18n: { ...(item.nameI18n || {}), en: event.target.value },
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="name en"
                            disabled={!canWritePolicies}
                          />
                          <Input
                            value={tier.nameI18n?.ja || ""}
                            onChange={(event) =>
                              setTiers((prev) =>
                                prev.map((item) =>
                                  item.id === tier.id
                                    ? {
                                        ...item,
                                        nameI18n: { ...(item.nameI18n || {}), ja: event.target.value },
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="name ja"
                            disabled={!canWritePolicies}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <Input
                            value={tier.descriptionI18n?.["zh-TW"] || ""}
                            onChange={(event) =>
                              setTiers((prev) =>
                                prev.map((item) =>
                                  item.id === tier.id
                                    ? {
                                        ...item,
                                        descriptionI18n: { ...(item.descriptionI18n || {}), "zh-TW": event.target.value },
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="description zh-TW"
                            disabled={!canWritePolicies}
                          />
                          <Input
                            value={tier.descriptionI18n?.en || ""}
                            onChange={(event) =>
                              setTiers((prev) =>
                                prev.map((item) =>
                                  item.id === tier.id
                                    ? {
                                        ...item,
                                        descriptionI18n: { ...(item.descriptionI18n || {}), en: event.target.value },
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="description en"
                            disabled={!canWritePolicies}
                          />
                          <Input
                            value={tier.descriptionI18n?.ja || ""}
                            onChange={(event) =>
                              setTiers((prev) =>
                                prev.map((item) =>
                                  item.id === tier.id
                                    ? {
                                        ...item,
                                        descriptionI18n: { ...(item.descriptionI18n || {}), ja: event.target.value },
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="description ja"
                            disabled={!canWritePolicies}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Label className="text-xs">USD cents</Label>
                          <Input
                            className="w-40"
                            type="number"
                            value={tier.priceCentsUsd ?? 0}
                            onChange={(event) =>
                              setTiers((prev) =>
                                prev.map((item) =>
                                  item.id === tier.id ? { ...item, priceCentsUsd: Number(event.target.value) } : item
                                )
                              )
                            }
                            disabled={!canWritePolicies}
                          />
                          <Label className="text-xs">Active</Label>
                          <Switch
                            checked={tier.isActive}
                            onCheckedChange={(checked) =>
                              setTiers((prev) =>
                                prev.map((item) => (item.id === tier.id ? { ...item, isActive: checked } : item))
                              )
                            }
                            disabled={!canWritePolicies}
                          />
                          <Label className="text-xs">Show on pricing</Label>
                          <Switch
                            checked={tier.showOnPricing ?? false}
                            onCheckedChange={(checked) =>
                              setTiers((prev) =>
                                prev.map((item) => (item.id === tier.id ? { ...item, showOnPricing: checked } : item))
                              )
                            }
                            disabled={!canWritePolicies}
                          />
                          <Label className="text-xs">Purchasable</Label>
                          <Switch
                            checked={tier.isPurchasable ?? false}
                            onCheckedChange={(checked) =>
                              setTiers((prev) =>
                                prev.map((item) => (item.id === tier.id ? { ...item, isPurchasable: checked } : item))
                              )
                            }
                            disabled={!canWritePolicies}
                          />
                          <Label className="text-xs">Renewal</Label>
                          <Switch
                            checked={tier.allowRenewalForExisting ?? false}
                            onCheckedChange={(checked) =>
                              setTiers((prev) =>
                                prev.map((item) =>
                                  item.id === tier.id ? { ...item, allowRenewalForExisting: checked } : item
                                )
                              )
                            }
                            disabled={!canWritePolicies}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => savePlan(tier)}
                            disabled={!canWritePolicies || savingPlanId === tier.id}
                          >
                            {savingPlanId === tier.id ? tCommon("saving") : tCommon("save")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
                    <div className="text-sm font-medium">New Plan</div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <Input
                        value={newPlan.code}
                        onChange={(event) => setNewPlan((prev) => ({ ...prev, code: event.target.value }))}
                        placeholder="code"
                        disabled={!canWritePolicies}
                      />
                      <Input
                        type="number"
                        value={newPlan.priceCentsUsd}
                        onChange={(event) => setNewPlan((prev) => ({ ...prev, priceCentsUsd: Number(event.target.value) }))}
                        placeholder="price cents usd"
                        disabled={!canWritePolicies}
                      />
                      <Button onClick={createPlan} disabled={!canWritePolicies || creatingPlan}>
                        {creatingPlan ? tCommon("saving") : "Create Plan"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input value={newPlan.nameI18n["zh-TW"]} onChange={(event) => setNewPlan((prev) => ({ ...prev, nameI18n: { ...prev.nameI18n, "zh-TW": event.target.value } }))} placeholder="name zh-TW" disabled={!canWritePolicies} />
                      <Input value={newPlan.nameI18n.en} onChange={(event) => setNewPlan((prev) => ({ ...prev, nameI18n: { ...prev.nameI18n, en: event.target.value } }))} placeholder="name en" disabled={!canWritePolicies} />
                      <Input value={newPlan.nameI18n.ja} onChange={(event) => setNewPlan((prev) => ({ ...prev, nameI18n: { ...prev.nameI18n, ja: event.target.value } }))} placeholder="name ja" disabled={!canWritePolicies} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input value={newPlan.descriptionI18n["zh-TW"]} onChange={(event) => setNewPlan((prev) => ({ ...prev, descriptionI18n: { ...prev.descriptionI18n, "zh-TW": event.target.value } }))} placeholder="description zh-TW" disabled={!canWritePolicies} />
                      <Input value={newPlan.descriptionI18n.en} onChange={(event) => setNewPlan((prev) => ({ ...prev, descriptionI18n: { ...prev.descriptionI18n, en: event.target.value } }))} placeholder="description en" disabled={!canWritePolicies} />
                      <Input value={newPlan.descriptionI18n.ja} onChange={(event) => setNewPlan((prev) => ({ ...prev, descriptionI18n: { ...prev.descriptionI18n, ja: event.target.value } }))} placeholder="description ja" disabled={!canWritePolicies} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium">Capability Display</div>
                  <div className="space-y-2">
                    {capabilities.map((capability) => (
                      <div key={capability.id} className="border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2 space-y-2">
                        <div className="text-sm font-medium">{capability.key}</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <Input value={capability.nameI18n?.["zh-TW"] || ""} onChange={(event) => setCapabilities((prev) => prev.map((item) => item.id === capability.id ? { ...item, nameI18n: { ...(item.nameI18n || {}), "zh-TW": event.target.value } } : item))} placeholder="name zh-TW" disabled={!canWritePolicies} />
                          <Input value={capability.nameI18n?.en || ""} onChange={(event) => setCapabilities((prev) => prev.map((item) => item.id === capability.id ? { ...item, nameI18n: { ...(item.nameI18n || {}), en: event.target.value } } : item))} placeholder="name en" disabled={!canWritePolicies} />
                          <Input value={capability.nameI18n?.ja || ""} onChange={(event) => setCapabilities((prev) => prev.map((item) => item.id === capability.id ? { ...item, nameI18n: { ...(item.nameI18n || {}), ja: event.target.value } } : item))} placeholder="name ja" disabled={!canWritePolicies} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <Input value={capability.descriptionI18n?.["zh-TW"] || ""} onChange={(event) => setCapabilities((prev) => prev.map((item) => item.id === capability.id ? { ...item, descriptionI18n: { ...(item.descriptionI18n || {}), "zh-TW": event.target.value } } : item))} placeholder="description zh-TW" disabled={!canWritePolicies} />
                          <Input value={capability.descriptionI18n?.en || ""} onChange={(event) => setCapabilities((prev) => prev.map((item) => item.id === capability.id ? { ...item, descriptionI18n: { ...(item.descriptionI18n || {}), en: event.target.value } } : item))} placeholder="description en" disabled={!canWritePolicies} />
                          <Input value={capability.descriptionI18n?.ja || ""} onChange={(event) => setCapabilities((prev) => prev.map((item) => item.id === capability.id ? { ...item, descriptionI18n: { ...(item.descriptionI18n || {}), ja: event.target.value } } : item))} placeholder="description ja" disabled={!canWritePolicies} />
                        </div>
                        <div className="flex items-center gap-3">
                          <Label className="text-xs">Show on pricing</Label>
                          <Switch
                            checked={capability.showOnPricing ?? false}
                            onCheckedChange={(checked) =>
                              setCapabilities((prev) =>
                                prev.map((item) => (item.id === capability.id ? { ...item, showOnPricing: checked } : item))
                              )
                            }
                            disabled={!canWritePolicies}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => saveCapability(capability)}
                            disabled={!canWritePolicies || savingCapabilityId === capability.id}
                          >
                            {savingCapabilityId === capability.id ? tCommon("saving") : tCommon("save")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium">{tAdmin("policyWritersTitle")}</div>
                  {policyWriters.length === 0 ? (
                    <div className="text-sm text-gray-500">{tAdmin("noPolicyWriters")}</div>
                  ) : (
                    <div className="space-y-2">
                      {policyWriters.map((writer) => (
                        <div
                          key={writer.id}
                          className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2"
                        >
                          <div>
                            <div className="text-sm font-medium">{writer.displayName || writer.email || writer.id}</div>
                            <div className="text-xs text-gray-500">{writer.email}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{tAdmin("policyWriterToggleLabel")}</span>
                            <Switch
                              checked={writer.canWritePolicy}
                              onCheckedChange={(checked) => setPolicyWriter(writer.id, checked)}
                              disabled={!currentUser?.isSuperAdmin || writer.isSuperAdmin || savingPolicyWriterId === writer.id}
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

      <Dialog open={!!editingSurvey} onOpenChange={(open) => !open && setEditingSurvey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tAdmin("editSurvey")}</DialogTitle>
            <DialogDescription>{tAdmin("editSurveyDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tAdmin("surveyTitle")}</Label>
              <Input value={surveyForm.title} onChange={(event) => setSurveyForm((prev) => ({ ...prev, title: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("surveyDescription")}</Label>
              <Input value={surveyForm.description} onChange={(event) => setSurveyForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{tAdmin("visibilityLabel")}</Label>
                <select
                  className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 w-full"
                  value={surveyForm.visibility}
                  onChange={(event) => setSurveyForm((prev) => ({ ...prev, visibility: event.target.value }))}
                >
                  <option value="public">{tAdmin("visibilityPublic")}</option>
                  <option value="non-public">{tAdmin("visibilityNonPublic")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{tAdmin("pointsReward")}</Label>
                <Input
                  type="number"
                  value={surveyForm.pointsReward}
                  onChange={(event) => setSurveyForm((prev) => ({ ...prev, pointsReward: Number(event.target.value) }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">{tAdmin("publishStatus")}</p>
                <p className="text-xs text-gray-500">{tAdmin("publishStatusHint")}</p>
              </div>
              <Switch
                checked={surveyForm.isPublished}
                onCheckedChange={(checked) => setSurveyForm((prev) => ({ ...prev, isPublished: checked }))}
              />
            </div>
            <div className="flex items-center justify-between border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">{tAdmin("datasetSharing")}</p>
                <p className="text-xs text-gray-500">{tAdmin("datasetSharingHint")}</p>
              </div>
              <Switch
                checked={surveyForm.includeInDatasets}
                onCheckedChange={(checked) => setSurveyForm((prev) => ({ ...prev, includeInDatasets: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSurvey(null)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={saveSurvey} disabled={savingSurvey}>
              {savingSurvey ? tCommon("saving") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingDataset} onOpenChange={(open) => !open && setEditingDataset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tAdmin("editDataset")}</DialogTitle>
            <DialogDescription>{tAdmin("editDatasetDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tAdmin("datasetTitle")}</Label>
              <Input value={datasetForm.title} onChange={(event) => setDatasetForm((prev) => ({ ...prev, title: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("datasetDescription")}</Label>
              <Input value={datasetForm.description} onChange={(event) => setDatasetForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{tAdmin("datasetCategory")}</Label>
                <Input value={datasetForm.category} onChange={(event) => setDatasetForm((prev) => ({ ...prev, category: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{tAdmin("accessType")}</Label>
                <select
                  className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 w-full"
                  value={datasetForm.accessType}
                  onChange={(event) => setDatasetForm((prev) => ({ ...prev, accessType: event.target.value }))}
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
                  onChange={(event) => setDatasetForm((prev) => ({ ...prev, price: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{tAdmin("datasetSamples")}</Label>
                <Input
                  type="number"
                  value={datasetForm.sampleSize}
                  onChange={(event) => setDatasetForm((prev) => ({ ...prev, sampleSize: Number(event.target.value) }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">{tAdmin("datasetActive")}</p>
                <p className="text-xs text-gray-500">{tAdmin("datasetActiveHint")}</p>
              </div>
              <Switch checked={datasetForm.isActive} onCheckedChange={(checked) => setDatasetForm((prev) => ({ ...prev, isActive: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDataset(null)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={saveDataset} disabled={savingDataset}>
              {savingDataset ? tCommon("saving") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tAdmin("uploadDataset")}</DialogTitle>
            <DialogDescription>{tAdmin("uploadDatasetDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tAdmin("surveyId")}</Label>
              <Input
                value={uploadForm.surveyId}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, surveyId: event.target.value }))}
                placeholder={tAdmin("surveyIdPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("datasetTitle")}</Label>
              <Input
                value={uploadForm.title}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("datasetDescription")}</Label>
              <Input
                value={uploadForm.description}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{tAdmin("datasetCategory")}</Label>
                <Input
                  value={uploadForm.category}
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, category: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{tAdmin("accessType")}</Label>
                <select
                  className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900 w-full"
                  value={uploadForm.accessType}
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, accessType: event.target.value }))}
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
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, price: Number(event.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>{tAdmin("datasetSamples")}</Label>
                <Input
                  type="number"
                  value={uploadForm.sampleSize}
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, sampleSize: Number(event.target.value) }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("datasetFile")}</Label>
              <Input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={uploadDataset} disabled={uploadingDataset}>
              {uploadingDataset ? tCommon("saving") : tAdmin("uploadAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
