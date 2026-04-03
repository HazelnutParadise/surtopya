package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/TimLai666/surtopya-api/internal/surveyanalytics"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type agentSurveyResponseRow struct {
	ID                  uuid.UUID  `json:"id"`
	SurveyID            uuid.UUID  `json:"survey_id"`
	SurveyVersionNumber int        `json:"survey_version_number"`
	UserID              *uuid.UUID `json:"user_id,omitempty"`
	AnonymousID         *string    `json:"anonymous_id,omitempty"`
	Status              string     `json:"status"`
	PointsAwarded       int        `json:"points_awarded"`
	StartedAt           time.Time  `json:"started_at"`
	CompletedAt         *time.Time `json:"completed_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
}

type agentResponseAnalyticsPayload struct {
	SelectedVersion   string                        `json:"selected_version"`
	AvailableVersions []int                         `json:"available_versions"`
	Summary           agentResponseAnalyticsSummary `json:"summary"`
	Pages             []agentResponseAnalyticsPage  `json:"pages"`
	Warnings          []string                      `json:"warnings"`
}

type agentResponseAnalyticsSummary struct {
	TotalCompletedResponses int    `json:"total_completed_responses"`
	QuestionCount           int    `json:"question_count"`
	GeneratedAt             string `json:"generated_at"`
}

type agentResponseAnalyticsQuestion struct {
	QuestionID       string                     `json:"question_id"`
	Title            string                     `json:"title"`
	Description      *string                    `json:"description,omitempty"`
	QuestionType     string                     `json:"question_type"`
	ResponseCount    int                        `json:"response_count"`
	OptionCounts     []agentResponseOptionCount `json:"option_counts"`
	AverageRating    *float64                   `json:"average_rating,omitempty"`
	MaxRating        *int                       `json:"max_rating,omitempty"`
	TextResponses    []string                   `json:"text_responses"`
	HasMoreResponses bool                       `json:"has_more_responses,omitempty"`
}

type agentResponseAnalyticsPage struct {
	PageID        string                           `json:"page_id"`
	Title         string                           `json:"title"`
	Description   *string                          `json:"description,omitempty"`
	QuestionCount int                              `json:"question_count"`
	Questions     []agentResponseAnalyticsQuestion `json:"questions"`
}

type agentResponseOptionCount struct {
	Label      string  `json:"label"`
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
}

// GetSurveyResponseAnalytics handles GET /v1/agent-admin/surveys/:id/responses/analytics.
func (h *AgentAdminHandler) GetSurveyResponseAnalytics(c *gin.Context) {
	identity := currentAgentIdentity(c)
	if identity == nil {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Agent identity missing", nil)
		return
	}

	surveyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid survey ID", nil)
		return
	}
	selectedVersion, err := normalizeAnalyticsVersion(c.Query("version"))
	if err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid version query", nil)
		return
	}

	survey := h.loadSurveyForAgent(c, surveyID)
	if survey == nil {
		return
	}
	if !identity.OwnerIsSuperAdmin && survey.UserID != identity.OwnerUserID {
		agentJSONError(c, http.StatusForbidden, "forbidden", "Agent permission denied", nil)
		return
	}

	responseHandler := &ResponseHandler{
		db:           h.db,
		responseRepo: repository.NewResponseRepository(h.db),
		surveyRepo:   repository.NewSurveyRepository(h.db),
	}

	report, err := responseHandler.buildSurveyResponseAnalytics(surveyID, selectedVersion, false)
	if err != nil {
		if errors.Is(err, surveyanalytics.ErrVersionNotFound) {
			agentJSONError(c, http.StatusNotFound, "not_found", "Survey version not found", nil)
			return
		}
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to build survey analytics", nil)
		return
	}

	c.JSON(http.StatusOK, mapAgentResponseAnalytics(report))
}

func (h *AgentAdminHandler) GetSurveyResponses(c *gin.Context) {
	identity := currentAgentIdentity(c)
	if identity == nil {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Agent identity missing", nil)
		return
	}

	surveyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid survey ID", nil)
		return
	}

	survey := h.loadSurveyForAgent(c, surveyID)
	if survey == nil {
		return
	}
	if !identity.OwnerIsSuperAdmin && survey.UserID != identity.OwnerUserID {
		agentJSONError(c, http.StatusForbidden, "forbidden", "Agent permission denied", nil)
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	responseRepo := repository.NewResponseRepository(h.db)
	responses, err := responseRepo.ListBySurveyIDPage(surveyID, limit, offset)
	if err != nil {
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to load survey responses", nil)
		return
	}
	total, err := responseRepo.CountBySurveyID(surveyID)
	if err != nil {
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to load survey responses", nil)
		return
	}

	rows := make([]agentSurveyResponseRow, 0, len(responses))
	for _, response := range responses {
		rows = append(rows, agentSurveyResponseRow{
			ID:                  response.ID,
			SurveyID:            response.SurveyID,
			SurveyVersionNumber: response.SurveyVersionNumber,
			UserID:              response.UserID,
			AnonymousID:         response.AnonymousID,
			Status:              response.Status,
			PointsAwarded:       response.PointsAwarded,
			StartedAt:           response.StartedAt,
			CompletedAt:         response.CompletedAt,
			CreatedAt:           response.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"responses": rows,
		"meta": gin.H{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

func (h *AgentAdminHandler) loadSurveyForAgent(c *gin.Context, surveyID uuid.UUID) *models.Survey {
	surveyRepo := repository.NewSurveyRepository(h.db)
	survey, err := surveyRepo.GetByID(surveyID)
	if err != nil {
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to get survey", nil)
		return nil
	}
	if survey == nil {
		agentJSONError(c, http.StatusNotFound, "not_found", "Survey not found", nil)
		return nil
	}
	return survey
}

func mapAgentResponseAnalytics(report surveyanalytics.Report) agentResponseAnalyticsPayload {
	pages := make([]agentResponseAnalyticsPage, 0, len(report.Pages))
	for _, page := range report.Pages {
		pages = append(pages, agentResponseAnalyticsPage{
			PageID:        page.PageID,
			Title:         page.Title,
			Description:   page.Description,
			QuestionCount: page.QuestionCount,
			Questions:     mapAgentQuestions(page.Questions),
		})
	}

	return agentResponseAnalyticsPayload{
		SelectedVersion:   report.SelectedVersion,
		AvailableVersions: append([]int{}, report.AvailableVersions...),
		Summary: agentResponseAnalyticsSummary{
			TotalCompletedResponses: report.Summary.TotalCompletedResponses,
			QuestionCount:           report.Summary.QuestionCount,
			GeneratedAt:             report.Summary.GeneratedAt.Format(time.RFC3339),
		},
		Pages:    pages,
		Warnings: append([]string{}, report.Warnings...),
	}
}

func mapAgentQuestions(questions []surveyanalytics.QuestionAnalytics) []agentResponseAnalyticsQuestion {
	result := make([]agentResponseAnalyticsQuestion, 0, len(questions))
	for _, question := range questions {
		result = append(result, agentResponseAnalyticsQuestion{
			QuestionID:       question.QuestionID,
			Title:            question.Title,
			Description:      question.Description,
			QuestionType:     question.QuestionType,
			ResponseCount:    question.ResponseCount,
			OptionCounts:     mapAgentOptionCounts(question),
			AverageRating:    question.AverageRating,
			MaxRating:        question.MaxRating,
			TextResponses:    []string{},
			HasMoreResponses: question.HasMoreResponses,
		})
	}
	return result
}

func mapAgentOptionCounts(question surveyanalytics.QuestionAnalytics) []agentResponseOptionCount {
	switch question.QuestionType {
	case "single", "select", "multi", "rating", "date":
		optionCounts := make([]agentResponseOptionCount, 0, len(question.OptionCounts))
		for _, option := range question.OptionCounts {
			optionCounts = append(optionCounts, agentResponseOptionCount{
				Label:      option.Label,
				Count:      option.Count,
				Percentage: option.Percentage,
			})
		}
		return optionCounts
	default:
		return []agentResponseOptionCount{}
	}
}
