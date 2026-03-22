package agentadmin

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseKeyPrefix_AllowsUnderscoresInsideSecret(t *testing.T) {
	prefix, err := parseKeyPrefix("saa_OOknOw_eay_qWhiTTpGnBz4Rpx_m-QY2PWrT_OL")
	require.NoError(t, err)
	require.Equal(t, "OOknOw", prefix)
}

func TestNormalizePermissions_IncludesDeidAndFiltersInvalid(t *testing.T) {
	permissions := normalizePermissions([]string{
		"deid.read",
		"deid.write",
		"surveys.read",
		"deid.read",
		"unknown.permission",
		"",
	})

	require.Equal(t, []string{
		"deid.read",
		"deid.write",
		"surveys.read",
	}, permissions)
}
