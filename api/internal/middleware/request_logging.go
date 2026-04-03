package middleware

import (
	"bytes"
	"context"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/platformlog"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type responseBodyRecorder struct {
	gin.ResponseWriter
	body bytes.Buffer
}

func (r *responseBodyRecorder) Write(data []byte) (int, error) {
	if r.body.Len() < 16*1024 {
		_, _ = r.body.Write(data)
	}
	return r.ResponseWriter.Write(data)
}

func RequestLoggingMiddleware() gin.HandlerFunc {
	logger := platformlog.NewLogger(database.GetDB())

	return func(c *gin.Context) {
		correlationID := uuid.New()
		c.Set(platformlog.ContextKeyCorrelationID, correlationID)
		c.Request = c.Request.WithContext(contextWithCorrelationID(c.Request.Context(), correlationID))
		c.Writer.Header().Set(platformlog.HeaderCorrelationID, correlationID.String())

		if shouldSkipRequestLogging(c.Request.URL.Path) {
			c.Next()
			return
		}

		startedAt := time.Now().UTC()

		var requestBody []byte
		if c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewReader(requestBody))
		}

		recorder := &responseBodyRecorder{ResponseWriter: c.Writer}
		c.Writer = recorder

		c.Next()

		status := "success"
		if c.Writer.Status() >= http.StatusBadRequest {
			status = "error"
		}

		module, action := inferModuleAndAction(c.Request.Method, c.FullPath(), c.Request.URL.Path)
		requestSummary := platformlog.ExtractRequestPayload(c, requestBody)
		responseSummary := platformlog.ExtractResponsePayload(c.Writer.Status(), c.Writer.Header(), recorder.body.Bytes())
		errorCode, errorMessage := inferErrorDetails(responseSummary)

		_ = logger.Log(c.Request.Context(), platformlog.EventInput{
			CorrelationID:   correlationID,
			EventType:       "request",
			Module:          module,
			Action:          action,
			Status:          status,
			ClientIP:        extractClientIP(c.Request),
			ActorType:       platformlog.ActorTypeFromGin(c),
			ActorUserID:     platformlog.ActorUserIDFromGin(c),
			ActorAgentID:    platformlog.ActorAgentIDFromGin(c),
			OwnerUserID:     platformlog.OwnerUserIDFromGin(c),
			RequestSummary:  requestSummary,
			ResponseSummary: responseSummary,
			ErrorCode:       errorCode,
			ErrorMessage:    errorMessage,
			Metadata: map[string]any{
				"http_status":   c.Writer.Status(),
				"duration_ms":   time.Since(startedAt).Milliseconds(),
				"path":          c.Request.URL.Path,
				"path_template": c.FullPath(),
			},
		})
	}
}

func shouldSkipRequestLogging(path string) bool {
	switch path {
	case "/v1/health", "/v1/ready":
		return true
	default:
		return strings.Contains(path, "/openapi.json")
	}
}

func inferModuleAndAction(method string, fullPath string, fallbackPath string) (string, string) {
	path := fullPath
	if strings.TrimSpace(path) == "" {
		path = fallbackPath
	}
	return inferModule(path), inferAction(method, path)
}

func inferErrorDetails(responseSummary map[string]any) (string, string) {
	code, _ := responseSummary["error_code"].(string)
	message, _ := responseSummary["error_message"].(string)
	return code, message
}

func contextWithCorrelationID(ctx context.Context, correlationID uuid.UUID) context.Context {
	return context.WithValue(ctx, platformlog.ContextKeyCorrelationID, correlationID)
}

func inferModule(path string) string {
	switch {
	case strings.HasPrefix(path, "/api/app/ui-events"):
		return "ui"
	case strings.HasPrefix(path, "/v1/agent-admin"), strings.HasPrefix(path, "/api/app/admin/agents"):
		if strings.Contains(path, "/deid") {
			return "deid"
		}
		if strings.Contains(path, "/users") {
			return "users"
		}
		if strings.Contains(path, "/datasets") {
			return "datasets"
		}
		if strings.Contains(path, "/responses") {
			return "responses"
		}
		if strings.Contains(path, "/surveys") {
			return "surveys"
		}
		if strings.Contains(path, "/subscription-plans") || strings.Contains(path, "/policies") || strings.Contains(path, "/policy-writers") || strings.Contains(path, "/capabilities") || strings.Contains(path, "/pricing") {
			return "policies"
		}
		if strings.Contains(path, "/system-settings") {
			return "system"
		}
		if strings.Contains(path, "/logs") || strings.Contains(path, "/agents") {
			return "agent_admin"
		}
		return "agent_admin"
	case strings.HasPrefix(path, "/api/app/me"), strings.HasPrefix(path, "/v1/authors"), strings.HasPrefix(path, "/api/app/authors"):
		return "users"
	case strings.Contains(path, "/auth"):
		return "auth"
	case strings.Contains(path, "/deid"):
		return "deid"
	case strings.Contains(path, "/datasets"):
		return "datasets"
	case strings.Contains(path, "/responses"):
		return "responses"
	case strings.Contains(path, "/surveys"):
		return "surveys"
	case strings.Contains(path, "/users"):
		return "users"
	case strings.Contains(path, "/subscription-plans"), strings.Contains(path, "/policies"), strings.Contains(path, "/policy-writers"), strings.Contains(path, "/capabilities"), strings.Contains(path, "/pricing"):
		return "policies"
	case strings.HasPrefix(path, "/v1/health"), strings.HasPrefix(path, "/v1/ready"), strings.HasPrefix(path, "/api/app/bootstrap"), strings.HasPrefix(path, "/api/app/config"), strings.HasPrefix(path, "/api/app/system-settings"):
		return "system"
	default:
		return "system"
	}
}

func inferAction(method string, path string) string {
	action := strings.ToLower(method)
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return action
	}

	segments := strings.Split(trimmed, "/")
	for i := len(segments) - 1; i >= 0; i-- {
		segment := strings.TrimSpace(segments[i])
		if segment == "" || segment == "api" || segment == "app" || segment == "v1" || segment == "agent-admin" || segment == "admin" {
			continue
		}
		if strings.HasPrefix(segment, ":") || strings.Contains(segment, "{") || strings.Contains(segment, "}") {
			continue
		}
		if _, err := uuid.Parse(segment); err == nil {
			continue
		}
		return action + "." + strings.ReplaceAll(segment, "-", "_")
	}
	return action
}

func extractClientIP(req *http.Request) *string {
	if req == nil {
		return nil
	}

	for _, candidate := range []string{
		strings.TrimSpace(req.Header.Get("CF-Connecting-IP")),
		firstForwardedIP(req.Header.Get("X-Forwarded-For")),
		remoteAddressHost(req.RemoteAddr),
	} {
		if candidate == "" {
			continue
		}
		value := candidate
		return &value
	}
	return nil
}

func firstForwardedIP(value string) string {
	for _, item := range strings.Split(value, ",") {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func remoteAddressHost(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	host, _, err := net.SplitHostPort(trimmed)
	if err == nil {
		return strings.TrimSpace(host)
	}
	return trimmed
}
