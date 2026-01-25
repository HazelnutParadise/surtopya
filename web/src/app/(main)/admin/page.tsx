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
import type { AdminUser, Dataset, Survey, UserProfile } from "@/lib/api"

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

  const surveyCountLabel = useMemo(() => tAdmin("surveyCount", { count: surveys.length }), [surveys.length, tAdmin])
  const datasetCountLabel = useMemo(() => tAdmin("datasetCount", { count: datasets.length }), [datasets.length, tAdmin])
  const adminCountLabel = useMemo(() => tAdmin("adminCount", { count: users.length }), [users.length, tAdmin])

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
                  <select
                    className="border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-900"
                    value={datasetActive}
                    onChange={(event) => setDatasetActive(event.target.value)}
                  >
                    <option value="all">{tAdmin("activeAll")}</option>
                    <option value="true">{tAdmin("activeOnly")}</option>
                    <option value="false">{tAdmin("inactiveOnly")}</option>
                  </select>
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
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500">{tAdmin("adminToggleLabel")}</span>
                              <Switch
                                checked={user.isAdmin}
                                onCheckedChange={(checked) => toggleAdmin(user, checked)}
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
                disabled={surveyForm.visibility === "public"}
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
    </div>
  )
}
