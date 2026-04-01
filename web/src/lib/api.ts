// API client for Surtopya backend

import type { LogicCondition, LogicOperator, QuestionOption } from "@/types/survey"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.PUBLIC_API_URL ||
  "http://localhost:8080/v1";

interface ApiError {
  error: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)["Authorization"] =
        `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Health check
  async health() {
    return this.request<{ status: string; message: string }>("/health");
  }

  // Survey endpoints
  async getSurvey(id: string) {
    return this.request<Survey>(`/surveys/${id}`);
  }

  async getMySurveys() {
    return this.request<{ surveys: Survey[] }>("/surveys/my");
  }

  async getPublicSurveys(limit = 20, offset = 0, sort: "recommended" | "newest" | "points-high" = "newest") {
    return this.request<{ surveys: Survey[] }>(
      `/surveys/public?limit=${limit}&offset=${offset}&sort=${encodeURIComponent(sort)}`,
    );
  }

  async createSurvey(data: CreateSurveyRequest) {
    return this.request<Survey>("/surveys", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateSurvey(id: string, data: UpdateSurveyRequest) {
    return this.request<Survey>(`/surveys/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteSurvey(id: string) {
    return this.request<{ message: string }>(`/surveys/${id}`, {
      method: "DELETE",
    });
  }

  async publishSurvey(id: string, data: PublishSurveyRequest) {
    return this.request<Survey>(`/surveys/${id}/publish`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async openSurveyResponses(id: string) {
    return this.request<Survey>(`/surveys/${id}/responses/open`, {
      method: "POST",
    });
  }

  async closeSurveyResponses(id: string) {
    return this.request<Survey>(`/surveys/${id}/responses/close`, {
      method: "POST",
    });
  }

  async listSurveyVersions(id: string) {
    return this.request<{ versions: SurveyVersion[] }>(
      `/surveys/${id}/versions`,
    );
  }

  async getSurveyVersion(id: string, versionNumber: number) {
    return this.request<SurveyVersion>(
      `/surveys/${id}/versions/${versionNumber}`,
    );
  }

  async restoreSurveyVersionDraft(id: string, versionNumber: number) {
    return this.request<Survey>(
      `/surveys/${id}/versions/${versionNumber}/restore-draft`,
      {
        method: "POST",
      },
    );
  }

  // Response endpoints
  async startResponse(surveyId: string, anonymousId?: string) {
    return this.request<SurveyResponse>(
      `/surveys/${surveyId}/responses/start`,
      {
        method: "POST",
        body: JSON.stringify({ anonymousId }),
      },
    );
  }

  async submitAnswer(
    responseId: string,
    questionId: string,
    value: AnswerValue,
  ) {
    return this.request<Answer>(`/responses/${responseId}/answers`, {
      method: "POST",
      body: JSON.stringify({ questionId, value }),
    });
  }

  async submitAllAnswers(responseId: string, answers: SubmitAnswerRequest[]) {
    return this.request<{
      message: string;
      response: SurveyResponse;
      pointsAwarded: number;
      completion?: ResponseCompletionCopy;
    }>(`/responses/${responseId}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  }

  async getSurveyResponses(surveyId: string) {
    return this.request<{ responses: SurveyResponse[] }>(
      `/surveys/${surveyId}/responses`,
    );
  }

  async getMyDrafts() {
    return this.request<{ drafts: ResponseDraftSummary[] }>("/drafts/my");
  }

  // Dataset endpoints
  async getDatasets(params?: {
    category?: string;
    accessType?: string;
    search?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set("category", params.category);
    if (params?.accessType) searchParams.set("accessType", params.accessType);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.sort) searchParams.set("sort", params.sort);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());

    const query = searchParams.toString();
    return this.request<{
      datasets: Dataset[];
      meta: { limit: number; offset: number };
    }>(`/datasets${query ? `?${query}` : ""}`);
  }

  async getDataset(id: string) {
    return this.request<Dataset>(`/datasets/${id}`);
  }

  async getCategories() {
    return this.request<{
      categories: Array<{ id: string; name: string; description: string }>;
    }>("/datasets/categories");
  }

  async downloadDataset(id: string) {
    return this.request<{ message: string; datasetId: string }>(
      `/datasets/${id}/download`,
      {
        method: "POST",
      },
    );
  }
}

// Types
export interface SurveyTheme {
  primaryColor: string;
  backgroundColor: string;
  fontFamily: string;
}

export interface LogicRule {
  triggerOption?: string;
  conditions?: LogicCondition[];
  operator?: LogicOperator;
  destinationQuestionId: string;
}

export interface Question {
  id: string;
  surveyId?: string;
  type: string;
  title: string;
  description?: string;
  options?: QuestionOption[];
  required: boolean;
  maxRating?: number;
   minSelections?: number;
   maxSelections?: number;
   defaultDestinationQuestionId?: string;
  logic?: LogicRule[];
  sortOrder?: number;
}

export interface Survey {
  id: string;
  userId?: string;
  author?: {
    id: string;
    slug: string;
    displayName: string;
    avatarUrl?: string;
  };
  title: string;
  description: string;
  completionTitle?: string;
  completionMessage?: string;
  visibility: "public" | "non-public";
  requireLoginToRespond?: boolean;
  isResponseOpen: boolean;
  includeInDatasets: boolean;
  everPublic?: boolean;
  publishedCount: number;
  hasUnpublishedChanges: boolean;
  currentPublishedVersionId?: string;
  currentPublishedVersionNumber?: number;
  theme?: SurveyTheme;
  pointsReward: number;
  expiresAt?: string;
  responseCount: number;
  isHot?: boolean;
  hasResponded?: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  questions?: Question[];
}

export interface SurveyVersion {
  id: string;
  surveyId: string;
  versionNumber: number;
  snapshot: {
    title: string;
    description: string;
    completionTitle?: string;
    completionMessage?: string;
    visibility: "public" | "non-public";
    includeInDatasets: boolean;
    theme?: SurveyTheme;
    pointsReward: number;
    expiresAt?: string;
    questions: Question[];
  };
  pointsReward: number;
  expiresAt?: string;
  publishedAt: string;
  publishedBy?: string;
  createdAt: string;
}

export interface CreateSurveyRequest {
  title: string;
  description: string;
  completionTitle?: string;
  completionMessage?: string;
  visibility: "public" | "non-public";
  requireLoginToRespond?: boolean;
  includeInDatasets: boolean;
  theme?: SurveyTheme;
  pointsReward: number;
  expiresAtLocal?: string;
  timeZone?: string;
  questions?: Omit<Question, "surveyId" | "sortOrder">[];
}

export interface UpdateSurveyRequest {
  title?: string;
  description?: string;
  completionTitle?: string;
  completionMessage?: string;
  requireLoginToRespond?: boolean;
  theme?: SurveyTheme;
  pointsReward?: number;
  expiresAtLocal?: string;
  timeZone?: string;
  questions?: Omit<Question, "surveyId" | "sortOrder">[];
}

export interface UserSettingsResponse {
  locale: string;
  timeZone: string;
  settingsAutoInitialized: boolean;
}

export interface PublishSurveyRequest {
  visibility: "public" | "non-public";
  includeInDatasets: boolean;
  pointsReward: number;
}

export interface AnswerValue {
  value?: string;
  values?: string[];
  text?: string;
  rating?: number;
  date?: string;
  otherText?: string;
}

export interface Answer {
  id: string;
  responseId: string;
  questionId: string;
  value: AnswerValue;
  createdAt: string;
}

export interface SubmitAnswerRequest {
  questionId: string;
  value: AnswerValue;
}

export interface ResponseCompletionCopy {
  title?: string;
  message?: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  surveyVersionId: string;
  surveyVersionNumber: number;
  userId?: string;
  anonymousId?: string;
  status: "in_progress" | "completed" | "abandoned";
  pointsAwarded: number;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  answers?: Answer[];
}

export interface SurveyResponseAnalyticsOptionCount {
  label: string
  count: number
  percentage: number
}

export interface SurveyResponseAnalyticsQuestion {
  questionId: string
  title: string
  description?: string
  questionType: "single" | "select" | "multi" | "rating" | "date" | "text" | "short" | "long"
  responseCount: number
  optionCounts: SurveyResponseAnalyticsOptionCount[]
  averageRating?: number
  maxRating?: number
  textResponses: string[]
  hasMoreResponses?: boolean
}

export interface SurveyResponseAnalyticsPage {
  pageId: string
  title: string
  description?: string
  questionCount: number
  questions: SurveyResponseAnalyticsQuestion[]
}

export interface SurveyResponseAnalyticsSummary {
  totalCompletedResponses: number
  questionCount: number
  generatedAt: string
}

export interface SurveyResponseAnalytics {
  selectedVersion: string
  availableVersions: number[]
  summary: SurveyResponseAnalyticsSummary
  pages: SurveyResponseAnalyticsPage[]
  warnings: string[]
}

const surveyAnalyticsQuestionTypes = new Set<SurveyResponseAnalyticsQuestion["questionType"]>([
  "single",
  "select",
  "multi",
  "rating",
  "date",
  "text",
  "short",
  "long",
])

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value == null) return null
  return value as Record<string, unknown>
}

const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback)

const asOptionalString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : undefined

const asNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

const asOptionalNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined

const asBoolean = (value: unknown, fallback = false) =>
  typeof value === "boolean" ? value : fallback

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

const asNumberArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    : []

const normalizeSurveyResponseAnalyticsQuestionType = (
  value: unknown
): SurveyResponseAnalyticsQuestion["questionType"] =>
  typeof value === "string" && surveyAnalyticsQuestionTypes.has(value as SurveyResponseAnalyticsQuestion["questionType"])
    ? (value as SurveyResponseAnalyticsQuestion["questionType"])
    : "text"

const normalizeSurveyResponseAnalyticsOptionCount = (
  value: unknown
): SurveyResponseAnalyticsOptionCount | null => {
  const record = asRecord(value)
  if (!record) return null

  return {
    label: asString(record.label),
    count: asNumber(record.count),
    percentage: asNumber(record.percentage),
  }
}

const normalizeSurveyResponseAnalyticsQuestion = (
  value: unknown
): SurveyResponseAnalyticsQuestion | null => {
  const record = asRecord(value)
  if (!record) return null

  const optionCounts = Array.isArray(record.optionCounts)
    ? record.optionCounts
      .map(normalizeSurveyResponseAnalyticsOptionCount)
      .filter((item): item is SurveyResponseAnalyticsOptionCount => item !== null)
    : []

  return {
    questionId: asString(record.questionId),
    title: asString(record.title),
    description: asOptionalString(record.description),
    questionType: normalizeSurveyResponseAnalyticsQuestionType(record.questionType),
    responseCount: asNumber(record.responseCount),
    optionCounts,
    averageRating: asOptionalNumber(record.averageRating),
    maxRating: asOptionalNumber(record.maxRating),
    textResponses: asStringArray(record.textResponses),
    hasMoreResponses: asBoolean(record.hasMoreResponses),
  }
}

const normalizeSurveyResponseAnalyticsPage = (
  value: unknown
): SurveyResponseAnalyticsPage | null => {
  const record = asRecord(value)
  if (!record) return null

  const questions = Array.isArray(record.questions)
    ? record.questions
      .map(normalizeSurveyResponseAnalyticsQuestion)
      .filter((item): item is SurveyResponseAnalyticsQuestion => item !== null)
    : []

  return {
    pageId: asString(record.pageId),
    title: asString(record.title),
    description: asOptionalString(record.description),
    questionCount: asNumber(record.questionCount, questions.length),
    questions,
  }
}

export const normalizeSurveyResponseAnalytics = (
  value: unknown,
  selectedVersionFallback = "all"
): SurveyResponseAnalytics => {
  const record = asRecord(value)
  const summary = asRecord(record?.summary)
  const legacyQuestions = Array.isArray(record?.questions)
    ? record.questions
      .map(normalizeSurveyResponseAnalyticsQuestion)
      .filter((item): item is SurveyResponseAnalyticsQuestion => item !== null)
    : []
  const pages = Array.isArray(record?.pages)
    ? record.pages
      .map(normalizeSurveyResponseAnalyticsPage)
      .filter((item): item is SurveyResponseAnalyticsPage => item !== null)
    : legacyQuestions.length > 0
      ? [
        {
          pageId: "legacy-page-1",
          title: "",
          questionCount: legacyQuestions.length,
          questions: legacyQuestions,
        },
      ]
      : []
  const normalizedQuestionCount = pages.reduce((total, page) => total + page.questions.length, 0)

  return {
    selectedVersion: asString(record?.selectedVersion, selectedVersionFallback),
    availableVersions: asNumberArray(record?.availableVersions),
    summary: {
      totalCompletedResponses: asNumber(summary?.totalCompletedResponses),
      questionCount: asNumber(summary?.questionCount, normalizedQuestionCount),
      generatedAt: asString(summary?.generatedAt),
    },
    pages,
    warnings: asStringArray(record?.warnings),
  }
}

export interface ResponseDraftSummary {
  id: string;
  surveyId: string;
  surveyTitle: string;
  surveyVersionId: string;
  surveyVersionNumber: number;
  startedAt: string;
  updatedAt: string;
  canResume: boolean;
}

export interface CompletedResponseSummary {
  id: string;
  surveyId: string;
  surveyTitle: string;
  surveyVersionNumber: number;
  pointsAwarded: number;
  completedAt?: string;
}

export interface Dataset {
  id: string;
  surveyId?: string;
  title: string;
  description?: string;
  category: string;
  accessType: "free" | "paid";
  price: number;
  downloadCount: number;
  sampleSize: number;
  isActive: boolean;
  currentPublishedVersionId?: string;
  currentPublishedVersionNumber?: number;
  hasUnpublishedChanges?: boolean;
  entitlementPolicy?: "purchased_only" | "all_versions_if_any_purchase";
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  phone?: string;
  bio?: string;
  location?: string;
  pointsBalance: number;
  nextMonthlyPointsGrantAt?: string;
  monthlyPointsGrant: number;
  membershipTier: string;
  membershipPeriodEndAt?: string;
  membershipIsPermanent?: boolean;
  capabilities: Record<string, boolean>;
  locale: string;
  publicProfile: {
    showDisplayName: boolean;
    showAvatar: boolean;
    showBio: boolean;
    showLocation: boolean;
    showPhone: boolean;
    showEmail: boolean;
  };
  createdAt: string;
  surveysCompleted: number;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface AuthorPageAuthor {
  id: string;
  slug: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  phone?: string;
  email?: string;
  memberSince: string;
}

export interface AuthorPageResponse {
  author: AuthorPageAuthor;
  surveys: Survey[];
  canonicalSlug: string;
  meta?: {
    limit?: number;
    offset?: number;
  };
}

export interface AdminUser {
  id: string;
  email?: string;
  displayName?: string;
  pointsBalance?: number;
  membershipTier: string;
  membershipPeriodEndAt?: string;
  membershipIsPermanent?: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isDisabled?: boolean;
  createdAt: string;
}

export interface MembershipTier {
  id: string;
  code: string;
  name: string;
  nameI18n?: Record<string, string>;
  descriptionI18n?: Record<string, string>;
  isActive?: boolean;
  isPurchasable?: boolean;
  showOnPricing?: boolean;
  priceCentsUsd?: number;
  billingInterval?: string;
  allowRenewalForExisting?: boolean;
  monthlyPointsGrant?: number;
  maxActiveSurveys?: number | null;
  replacementTierCode?: string;
}

export interface Capability {
  id: string;
  key: string;
  name: string;
  description?: string;
  nameI18n?: Record<string, string>;
  descriptionI18n?: Record<string, string>;
  isActive: boolean;
  showOnPricing?: boolean;
}

export interface PolicyMatrixEntry {
  tierCode: string;
  capabilityKey: string;
  isAllowed: boolean;
}

export interface PolicyWriter {
  id: string;
  email?: string;
  displayName?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canWritePolicy: boolean;
}

export interface AgentAdminAccount {
  id: string;
  owner_user_id: string;
  owner_display_name?: string;
  owner_email?: string;
  owner_is_super_admin?: boolean;
  name: string;
  description?: string;
  is_active: boolean;
  created_by_user_id: string;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
  permissions: string[];
  key_prefix?: string;
}

export interface PlatformEventLog {
  id: string;
  created_at: string;
  correlation_id: string;
  event_type: string;
  module: string;
  action: string;
  status: string;
  actor_type: string;
  actor_user_id?: string;
  actor_agent_id?: string;
  owner_user_id?: string;
  resource_type?: string;
  resource_id?: string;
  resource_owner_user_id?: string;
  request_summary: Record<string, unknown>;
  response_summary: Record<string, unknown>;
  error_code?: string;
  error_message?: string;
  metadata: Record<string, unknown>;
}

export interface PricingBenefit {
  key: string;
  name: string;
  description: string;
}

export interface PricingPlan {
  code: string;
  name: string;
  description: string;
  priceCentsUsd: number;
  monthlyPointsGrant: number;
  maxActiveSurveys?: number | null;
  currency: "USD";
  billingInterval: "month";
  isPurchasable: boolean;
  benefits: PricingBenefit[];
}

// Export singleton instance
export const api = new ApiClient();
export default api;

