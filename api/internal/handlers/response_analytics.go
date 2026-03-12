package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/TimLai666/surtopya-api/internal/surveyanalytics"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ownerResponseAnalyticsPayload struct {
	SelectedVersion   string                           `json:"selectedVersion"`
	AvailableVersions []int                            `json:"availableVersions"`
	Summary           ownerResponseAnalyticsSummary    `json:"summary"`
	Questions         []ownerResponseAnalyticsQuestion `json:"questions"`
	Warnings          []string                         `json:"warnings"`
}

type ownerResponseAnalyticsSummary struct {
	TotalCompletedResponses int       `json:"totalCompletedResponses"`
	QuestionCount           int       `json:"questionCount"`
	GeneratedAt             time.Time `json:"generatedAt"`
}

type ownerResponseAnalyticsQuestion struct {
	QuestionID       string                      `json:"questionId"`
	Title            string                      `json:"title"`
	Description      *string                     `json:"description,omitempty"`
	QuestionType     string                      `json:"questionType"`
	ResponseCount    int                         `json:"responseCount"`
	OptionCounts     *[]ownerResponseOptionCount `json:"optionCounts,omitempty"`
	AverageRating    *float64                    `json:"averageRating,omitempty"`
	MaxRating        *int                        `json:"maxRating,omitempty"`
	TextResponses    *[]string                   `json:"textResponses,omitempty"`
	HasMoreResponses bool                        `json:"hasMoreResponses,omitempty"`
}

type ownerResponseOptionCount struct {
	Label      string  `json:"label"`
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
}

// GetSurveyResponseAnalytics handles GET /api/v1/surveys/:id/responses/analytics.
func (h *ResponseHandler) GetSurveyResponseAnalytics(c *gin.Context) {
	surveyID, selectedVersion, ok := parseResponseAnalyticsRequest(c)
	if !ok {
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	survey, err := h.surveyRepo.GetByID(surveyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get survey"})
		return
	}
	if survey == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Survey not found"})
		return
	}
	if survey.UserID != userID.(uuid.UUID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	report, err := h.buildSurveyResponseAnalytics(surveyID, selectedVersion, true)
	if err != nil {
		if errors.Is(err, surveyanalytics.ErrVersionNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Survey version not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to build response analytics"})
		return
	}

	c.JSON(http.StatusOK, mapOwnerResponseAnalytics(report))
}

func (h *ResponseHandler) buildSurveyResponseAnalytics(surveyID uuid.UUID, selectedVersion string, includeTextResponses bool) (surveyanalytics.Report, error) {
	responses, err := h.responseRepo.GetBySurveyID(surveyID)
	if err != nil {
		return surveyanalytics.Report{}, err
	}

	versions, err := h.surveyRepo.ListVersionsBySurvey(surveyID)
	if err != nil {
		return surveyanalytics.Report{}, err
	}

	return surveyanalytics.BuildReport(versions, responses, surveyanalytics.BuildOptions{
		SelectedVersion:      selectedVersion,
		IncludeTextResponses: includeTextResponses,
		GeneratedAt:          time.Now().UTC(),
	})
}

func parseResponseAnalyticsRequest(c *gin.Context) (uuid.UUID, string, bool) {
	surveyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return uuid.Nil, "", false
	}

	selectedVersion, err := normalizeAnalyticsVersion(c.Query("version"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version query"})
		return uuid.Nil, "", false
	}

	return surveyID, selectedVersion, true
}

func normalizeAnalyticsVersion(raw string) (string, error) {
	if raw == "" || raw == "all" {
		return "all", nil
	}

	versionNumber, err := strconv.Atoi(raw)
	if err != nil || versionNumber < 1 {
		return "", errors.New("invalid version")
	}
	return strconv.Itoa(versionNumber), nil
}

func mapOwnerResponseAnalytics(report surveyanalytics.Report) ownerResponseAnalyticsPayload {
	questions := make([]ownerResponseAnalyticsQuestion, 0, len(report.Questions))
	for _, question := range report.Questions {
		optionCounts := mapOwnerOptionCounts(question)
		textResponses := mapOwnerTextResponses(question)

		questions = append(questions, ownerResponseAnalyticsQuestion{
			QuestionID:       question.QuestionID,
			Title:            question.Title,
			Description:      question.Description,
			QuestionType:     question.QuestionType,
			ResponseCount:    question.ResponseCount,
			OptionCounts:     optionCounts,
			AverageRating:    question.AverageRating,
			MaxRating:        question.MaxRating,
			TextResponses:    textResponses,
			HasMoreResponses: question.HasMoreResponses,
		})
	}

	return ownerResponseAnalyticsPayload{
		SelectedVersion:   report.SelectedVersion,
		AvailableVersions: append([]int{}, report.AvailableVersions...),
		Summary: ownerResponseAnalyticsSummary{
			TotalCompletedResponses: report.Summary.TotalCompletedResponses,
			QuestionCount:           report.Summary.QuestionCount,
			GeneratedAt:             report.Summary.GeneratedAt,
		},
		Questions: questions,
		Warnings:  append([]string{}, report.Warnings...),
	}
}

func mapOwnerOptionCounts(question surveyanalytics.QuestionAnalytics) *[]ownerResponseOptionCount {
	switch question.QuestionType {
	case "single", "select", "multi", "rating", "date":
		optionCounts := make([]ownerResponseOptionCount, 0, len(question.OptionCounts))
		for _, option := range question.OptionCounts {
			optionCounts = append(optionCounts, ownerResponseOptionCount{
				Label:      option.Label,
				Count:      option.Count,
				Percentage: option.Percentage,
			})
		}
		return &optionCounts
	default:
		return nil
	}
}

func mapOwnerTextResponses(question surveyanalytics.QuestionAnalytics) *[]string {
	switch question.QuestionType {
	case "text", "short", "long":
		textResponses := append([]string{}, question.TextResponses...)
		return &textResponses
	default:
		return nil
	}
}
