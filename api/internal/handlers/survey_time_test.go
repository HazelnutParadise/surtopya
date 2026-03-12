package handlers

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParseSurveyExpiresAt_LocalDateTimeToUTC(t *testing.T) {
	value, err := parseSurveyExpiresAt(stringPtr("2026-03-11T15:00"), stringPtr("Asia/Taipei"))
	require.NoError(t, err)
	require.NotNil(t, value)
	require.Equal(t, time.Date(2026, 3, 11, 7, 0, 0, 0, time.UTC), *value)
}

func TestParseSurveyExpiresAt_EmptyClearsValue(t *testing.T) {
	value, err := parseSurveyExpiresAt(stringPtr(""), stringPtr("Asia/Taipei"))
	require.NoError(t, err)
	require.Nil(t, value)
}

func TestParseSurveyExpiresAt_RequiresPairedFields(t *testing.T) {
	_, err := parseSurveyExpiresAt(stringPtr("2026-03-11T15:00"), nil)
	require.Error(t, err)

	_, err = parseSurveyExpiresAt(nil, stringPtr("Asia/Taipei"))
	require.Error(t, err)
}

func TestParseSurveyExpiresAt_RejectsInvalidTimeZone(t *testing.T) {
	_, err := parseSurveyExpiresAt(stringPtr("2026-03-11T15:00"), stringPtr("Mars/Olympus"))
	require.Error(t, err)
}

func stringPtr(value string) *string {
	return &value
}
