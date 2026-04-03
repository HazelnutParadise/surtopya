package platformlog

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSanitizePayload_RedactsAnswersAndSecrets(t *testing.T) {
	input := map[string]any{
		"answers": []any{
			map[string]any{
				"questionId": "q-1",
				"value": map[string]any{
					"text": "super secret freeform answer",
				},
			},
			map[string]any{
				"question_id": "q-2",
				"value": map[string]any{
					"rating": 5,
				},
			},
		},
		"claimToken": "claim-secret",
		"apiKey":     "key-secret",
		"nested": map[string]any{
			"authorization": "Bearer should-not-leak",
		},
	}

	got := SanitizePayload(input)

	require.Equal(t, "[redacted]", got["claim_token"])
	require.Equal(t, "[redacted]", got["api_key"])

	nested, ok := got["nested"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "[redacted]", nested["authorization"])

	answers, ok := got["answers"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(2), answers["count"])
	require.ElementsMatch(t, []any{"q-1", "q-2"}, answers["question_ids"].([]any))
	require.ElementsMatch(t, []any{"text", "rating"}, answers["value_types"].([]any))
	require.NotContains(t, answers, "items")
}

func TestExtractResponsePayload_StoresCompactMetadataOnly(t *testing.T) {
	headers := make(http.Header)
	headers.Set("Content-Type", "application/json")

	got := ExtractResponsePayload(422, headers, []byte(`{"code":"bad_request","message":"validation failed","details":{"field":"email"}}`))

	require.Equal(t, 422, got["status_code"])
	require.Equal(t, "application/json", got["content_type"])
	require.Equal(t, len([]byte(`{"code":"bad_request","message":"validation failed","details":{"field":"email"}}`)), got["body_size_bytes"])
	require.Equal(t, "bad_request", got["error_code"])
	require.Equal(t, "validation failed", got["error_message"])
	require.NotContains(t, got, "body")
}
