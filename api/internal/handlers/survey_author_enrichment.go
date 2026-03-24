package handlers

import (
	"strings"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/google/uuid"
)

func collectSurveyOwnerIDs(surveys []models.Survey) []uuid.UUID {
	seen := make(map[uuid.UUID]struct{}, len(surveys))
	ids := make([]uuid.UUID, 0, len(surveys))
	for _, survey := range surveys {
		if survey.UserID == uuid.Nil {
			continue
		}
		if _, exists := seen[survey.UserID]; exists {
			continue
		}
		seen[survey.UserID] = struct{}{}
		ids = append(ids, survey.UserID)
	}
	return ids
}

func attachAuthorsToSurveys(surveys []models.Survey, authorRepo *repository.AuthorRepository) error {
	if len(surveys) == 0 || authorRepo == nil {
		return nil
	}

	authors, err := authorRepo.BuildSurveyAuthorSummaries(collectSurveyOwnerIDs(surveys))
	if err != nil {
		return err
	}

	for i := range surveys {
		if summary, exists := authors[surveys[i].UserID]; exists {
			surveys[i].Author = summary
		}
	}
	return nil
}

func attachAuthorToSurvey(survey *models.Survey, authorRepo *repository.AuthorRepository) error {
	if survey == nil || authorRepo == nil || survey.UserID == uuid.Nil {
		return nil
	}

	authors, err := authorRepo.BuildSurveyAuthorSummaries([]uuid.UUID{survey.UserID})
	if err != nil {
		return err
	}
	survey.Author = authors[survey.UserID]
	return nil
}

func chooseAnonymousAuthorLabel(displayName string, fallback string) string {
	if strings.TrimSpace(displayName) != "" {
		return displayName
	}
	return fallback
}
