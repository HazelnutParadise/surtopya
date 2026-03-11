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
