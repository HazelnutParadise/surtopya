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

func TestValidateSurveyExpiresAtTransition_RejectsNewPastValue(t *testing.T) {
	now := time.Date(2026, 3, 11, 8, 0, 0, 0, time.UTC)
	next := time.Date(2026, 3, 11, 7, 0, 0, 0, time.UTC)

	err := validateSurveyExpiresAtTransition(nil, &next, now)
	require.EqualError(t, err, expirationDatePastError)
}

func TestValidateSurveyExpiresAtTransition_RejectsChangedToPastValue(t *testing.T) {
	now := time.Date(2026, 3, 11, 8, 0, 0, 0, time.UTC)
	current := time.Date(2026, 3, 11, 9, 0, 0, 0, time.UTC)
	next := time.Date(2026, 3, 11, 7, 0, 0, 0, time.UTC)

	err := validateSurveyExpiresAtTransition(&current, &next, now)
	require.EqualError(t, err, expirationDatePastError)
}

func TestValidateSurveyExpiresAtTransition_AllowsClearValue(t *testing.T) {
	now := time.Date(2026, 3, 11, 8, 0, 0, 0, time.UTC)
	current := time.Date(2026, 3, 11, 9, 0, 0, 0, time.UTC)

	err := validateSurveyExpiresAtTransition(&current, nil, now)
	require.NoError(t, err)
}

func TestValidateSurveyExpiresAtTransition_AllowsUnchangedLegacyPastValue(t *testing.T) {
	now := time.Date(2026, 3, 11, 8, 0, 0, 0, time.UTC)
	legacyPast := time.Date(2026, 3, 11, 7, 0, 0, 0, time.UTC)

	err := validateSurveyExpiresAtTransition(&legacyPast, &legacyPast, now)
	require.NoError(t, err)
}

func stringPtr(value string) *string {
	return &value
}
