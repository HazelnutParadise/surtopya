package handlers

import (
	"database/sql"
	"errors"
	"strconv"
	"strings"
)

const (
	surveyBasePointsSettingKey = "survey_base_points"
	defaultSurveyBasePoints    = 1
)

type queryRower interface {
	QueryRow(query string, args ...any) *sql.Row
}

func loadSurveyBasePoints(q queryRower) (int, error) {
	var raw string
	if err := q.QueryRow(
		"SELECT value FROM system_settings WHERE key = $1",
		surveyBasePointsSettingKey,
	).Scan(&raw); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return defaultSurveyBasePoints, nil
		}
		return 0, err
	}

	v, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || v < 0 {
		return defaultSurveyBasePoints, nil
	}

	return v, nil
}
