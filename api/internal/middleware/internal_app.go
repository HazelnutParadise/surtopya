package middleware

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/platformlog"
	"github.com/gin-gonic/gin"
)

const (
	internalAppTimestampHeader = "X-Surtopya-App-Timestamp"
	internalAppSignatureHeader = "X-Surtopya-App-Signature"
	internalAppClockSkew       = 5 * time.Minute
)

func loadInternalAppSigningSecret() string {
	secret := strings.TrimSpace(os.Getenv("INTERNAL_APP_SIGNING_SECRET"))
	if secret != "" {
		return secret
	}
	return strings.TrimSpace(os.Getenv("JWT_SECRET"))
}

func buildInternalAppCanonicalString(method string, path string, timestamp string, body []byte) string {
	bodyDigest := sha256.Sum256(body)
	return strings.Join([]string{
		strings.ToUpper(method),
		path,
		timestamp,
		hex.EncodeToString(bodyDigest[:]),
	}, "\n")
}

func signInternalAppCanonical(secret string, canonical string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(canonical))
	return hex.EncodeToString(mac.Sum(nil))
}

// RequireInternalApp validates HMAC-signed app-internal requests.
func RequireInternalApp() gin.HandlerFunc {
	secret := loadInternalAppSigningSecret()

	return func(c *gin.Context) {
		if secret == "" {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal app signing secret is not configured"})
			c.Abort()
			return
		}

		timestampHeader := c.GetHeader(internalAppTimestampHeader)
		signatureHeader := strings.TrimSpace(strings.ToLower(c.GetHeader(internalAppSignatureHeader)))
		if timestampHeader == "" || signatureHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing internal app signature"})
			c.Abort()
			return
		}

		timestampUnix, err := strconv.ParseInt(timestampHeader, 10, 64)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid internal app timestamp"})
			c.Abort()
			return
		}

		now := time.Now().Unix()
		if absInt64(now-timestampUnix) > int64(internalAppClockSkew.Seconds()) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Expired internal app signature"})
			c.Abort()
			return
		}

		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid request body"})
			c.Abort()
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))

		canonical := buildInternalAppCanonicalString(
			c.Request.Method,
			c.Request.URL.Path,
			timestampHeader,
			bodyBytes,
		)
		expectedSignature := signInternalAppCanonical(secret, canonical)
		if !hmac.Equal([]byte(expectedSignature), []byte(signatureHeader)) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid internal app signature"})
			c.Abort()
			return
		}

		c.Set(platformlog.ContextKeyActorType, platformlog.ActorTypeInternal)
		c.Next()
	}
}

func absInt64(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}
