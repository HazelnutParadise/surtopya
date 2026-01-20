// API client for Surtopya backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.PUBLIC_API_URL || 'http://localhost:8080/api/v1';

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
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Health check
  async health() {
    return this.request<{ status: string; message: string }>('/health');
  }

  // Survey endpoints
  async getSurvey(id: string) {
    return this.request<Survey>(`/surveys/${id}`);
  }

  async getMySurveys() {
    return this.request<{ surveys: Survey[] }>('/surveys/my');
  }

  async getPublicSurveys(limit = 20, offset = 0) {
    return this.request<{ surveys: Survey[] }>(`/surveys/public?limit=${limit}&offset=${offset}`);
  }

  async createSurvey(data: CreateSurveyRequest) {
    return this.request<Survey>('/surveys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSurvey(id: string, data: UpdateSurveyRequest) {
    return this.request<Survey>(`/surveys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSurvey(id: string) {
    return this.request<{ message: string }>(`/surveys/${id}`, {
      method: 'DELETE',
    });
  }

  async publishSurvey(id: string, data: PublishSurveyRequest) {
    return this.request<Survey>(`/surveys/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async unpublishSurvey(id: string) {
    return this.request<Survey>(`/surveys/${id}/unpublish`, {
      method: 'POST',
    });
  }

  // Response endpoints
  async startResponse(surveyId: string, anonymousId?: string) {
    return this.request<SurveyResponse>(`/surveys/${surveyId}/responses/start`, {
      method: 'POST',
      body: JSON.stringify({ anonymousId }),
    });
  }

  async submitAnswer(responseId: string, questionId: string, value: AnswerValue) {
    return this.request<Answer>(`/responses/${responseId}/answers`, {
      method: 'POST',
      body: JSON.stringify({ questionId, value }),
    });
  }

  async submitAllAnswers(responseId: string, answers: SubmitAnswerRequest[]) {
    return this.request<{
      message: string;
      response: SurveyResponse;
      pointsAwarded: number;
    }>(`/responses/${responseId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  }

  async getSurveyResponses(surveyId: string) {
    return this.request<{ responses: SurveyResponse[] }>(`/surveys/${surveyId}/responses`);
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
    if (params?.category) searchParams.set('category', params.category);
    if (params?.accessType) searchParams.set('accessType', params.accessType);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const query = searchParams.toString();
    return this.request<{ datasets: Dataset[]; meta: { limit: number; offset: number } }>(
      `/datasets${query ? `?${query}` : ''}`
    );
  }

  async getDataset(id: string) {
    return this.request<Dataset>(`/datasets/${id}`);
  }

  async getCategories() {
    return this.request<{
      categories: Array<{ id: string; name: string; description: string }>;
    }>('/datasets/categories');
  }

  async downloadDataset(id: string) {
    return this.request<{ message: string; datasetId: string }>(`/datasets/${id}/download`, {
      method: 'POST',
    });
  }
}

// Types
export interface SurveyTheme {
  primaryColor: string;
  backgroundColor: string;
  fontFamily: string;
}

export interface LogicRule {
  triggerOption: string;
  destinationQuestionId: string;
}

export interface Question {
  id: string;
  surveyId?: string;
  type: string;
  title: string;
  description?: string;
  options?: string[];
  required: boolean;
  points: number;
  maxRating?: number;
  logic?: LogicRule[];
  sortOrder?: number;
}

export interface Survey {
  id: string;
  userId?: string;
  title: string;
  description: string;
  visibility: 'public' | 'non-public';
  isPublished: boolean;
  includeInDatasets: boolean;
  publishedCount: number;
  theme?: SurveyTheme;
  pointsReward: number;
  expiresAt?: string;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  questions?: Question[];
}

export interface CreateSurveyRequest {
  title: string;
  description: string;
  visibility: 'public' | 'non-public';
  includeInDatasets: boolean;
  theme?: SurveyTheme;
  pointsReward: number;
  questions?: Omit<Question, 'surveyId' | 'sortOrder'>[];
}

export interface UpdateSurveyRequest {
  title?: string;
  description?: string;
  theme?: SurveyTheme;
  pointsReward?: number;
  questions?: Omit<Question, 'surveyId' | 'sortOrder'>[];
}

export interface PublishSurveyRequest {
  visibility: 'public' | 'non-public';
  includeInDatasets: boolean;
  pointsReward: number;
}

export interface AnswerValue {
  value?: string;
  values?: string[];
  text?: string;
  rating?: number;
  date?: string;
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

export interface SurveyResponse {
  id: string;
  surveyId: string;
  userId?: string;
  anonymousId?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  pointsAwarded: number;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  answers?: Answer[];
}

export interface Dataset {
  id: string;
  surveyId: string;
  title: string;
  description?: string;
  category: string;
  accessType: 'free' | 'paid';
  price: number;
  downloadCount: number;
  sampleSize: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Export singleton instance
export const api = new ApiClient();
export default api;
