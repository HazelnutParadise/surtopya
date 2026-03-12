package timeutil

import (
	"fmt"
	"strings"
	"time"
)

func LoadLocation(timeZone string) (*time.Location, error) {
	trimmed := strings.TrimSpace(timeZone)
	if trimmed == "" {
		return nil, fmt.Errorf("time zone is required")
	}

	location, err := time.LoadLocation(trimmed)
	if err != nil {
		return nil, fmt.Errorf("invalid time zone: %w", err)
	}

	return location, nil
}

func ParseLocalDateTimeToUTC(value string, timeZone string) (time.Time, error) {
	location, err := LoadLocation(timeZone)
	if err != nil {
		return time.Time{}, err
	}

	parsed, err := time.ParseInLocation("2006-01-02T15:04", strings.TrimSpace(value), location)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid local datetime: %w", err)
	}

	return parsed.UTC(), nil
}

func ParseLocalDateEndToUTC(value string, timeZone string) (time.Time, error) {
	location, err := LoadLocation(timeZone)
	if err != nil {
		return time.Time{}, err
	}

	parsed, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(value), location)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid local date: %w", err)
	}

	return time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 23, 59, 59, 0, location).UTC(), nil
}

func NextMonthlyBoundaryUTC(now time.Time, timeZone string) (time.Time, error) {
	location, err := LoadLocation(timeZone)
	if err != nil {
		return time.Time{}, err
	}

	localNow := now.In(location)
	nextMonthStart := time.Date(localNow.Year(), localNow.Month()+1, 1, 0, 0, 0, 0, location)
	return nextMonthStart.UTC(), nil
}
