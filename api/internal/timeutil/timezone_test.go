package timeutil

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestLoadLocation(t *testing.T) {
	testCases := []struct {
		name     string
		timeZone string
		wantErr  bool
	}{
		{
			name:     "valid Asia Taipei",
			timeZone: "Asia/Taipei",
			wantErr:  false,
		},
		{
			name:     "valid UTC",
			timeZone: "UTC",
			wantErr:  false,
		},
		{
			name:     "invalid timezone",
			timeZone: "Mars/Olympus",
			wantErr:  true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			location, err := LoadLocation(tc.timeZone)
			if tc.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, location)
		})
	}
}

func TestParseLocalDateTimeToUTC(t *testing.T) {
	value, err := ParseLocalDateTimeToUTC("2026-03-11T15:00", "Asia/Taipei")
	require.NoError(t, err)
	require.Equal(t, time.Date(2026, 3, 11, 7, 0, 0, 0, time.UTC), value)
}

func TestParseLocalDateTimeToUTC_RejectsInvalidTimeZone(t *testing.T) {
	_, err := ParseLocalDateTimeToUTC("2026-03-11T15:00", "Mars/Olympus")
	require.Error(t, err)
}

func TestParseLocalDateEndToUTC(t *testing.T) {
	value, err := ParseLocalDateEndToUTC("2026-03-11", "Asia/Taipei")
	require.NoError(t, err)
	require.Equal(t, time.Date(2026, 3, 11, 15, 59, 59, 0, time.UTC), value)
}

func TestNextMonthlyBoundaryUTC(t *testing.T) {
	now := time.Date(2026, 3, 11, 7, 0, 0, 0, time.UTC)

	value, err := NextMonthlyBoundaryUTC(now, "Asia/Taipei")
	require.NoError(t, err)
	require.Equal(t, time.Date(2026, 3, 31, 16, 0, 0, 0, time.UTC), value)
}
