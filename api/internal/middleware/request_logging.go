package middleware

import (
	"bytes"
	"context"
	"io"
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
	case "/api/v1/health", "/api/v1/ready":
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
	path = strings.TrimPrefix(path, "/api/")
	segments := strings.Split(strings.Trim(path, "/"), "/")
	module := "api"
	if len(segments) > 1 {
		module = segments[1]
	}
	action := strings.ToLower(method)
	if len(segments) > 2 {
		action = strings.Join(segments[2:], ".")
	}
	return module, action
}

func inferErrorDetails(responseSummary map[string]any) (string, string) {
	body, ok := responseSummary["body"].(map[string]any)
	if !ok {
		return "", ""
	}
	var (
		code    string
		message string
	)
	if rawCode, ok := body["code"].(string); ok {
		code = rawCode
	}
	if rawError, ok := body["error"].(string); ok && message == "" {
		message = rawError
	}
	if rawMessage, ok := body["message"].(string); ok && rawMessage != "" {
		message = rawMessage
	}
	return code, message
}

func contextWithCorrelationID(ctx context.Context, correlationID uuid.UUID) context.Context {
	return context.WithValue(ctx, platformlog.ContextKeyCorrelationID, correlationID)
}
