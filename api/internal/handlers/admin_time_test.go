package handlers

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParseMembershipPeriodEndAt_WithTimeZone(t *testing.T) {
	value, err := parseMembershipPeriodEndAt("2026-03-11", "Asia/Taipei")
	require.NoError(t, err)
	require.Equal(t, time.Date(2026, 3, 11, 15, 59, 59, 0, time.UTC), value)
}

func TestParseMembershipPeriodEndAt_RejectsInvalidTimeZone(t *testing.T) {
	_, err := parseMembershipPeriodEndAt("2026-03-11", "Mars/Olympus")
	require.Error(t, err)
}
