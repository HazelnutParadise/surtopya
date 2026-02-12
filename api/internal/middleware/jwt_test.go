package middleware

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"
)

func setEnv(t *testing.T, key, value string) {
	t.Helper()
	prev, ok := os.LookupEnv(key)
	if value == "" {
		require.NoError(t, os.Unsetenv(key))
	} else {
		require.NoError(t, os.Setenv(key, value))
	}
	t.Cleanup(func() {
		if !ok {
			_ = os.Unsetenv(key)
			return
		}
		_ = os.Setenv(key, prev)
	})
}

func TestLoadJWTConfigFromEnv_DefaultAllowUnverified(t *testing.T) {
	setEnv(t, "ALLOW_UNVERIFIED_JWT", "")

	setEnv(t, "SURTOPYA_ENV", "development")
	cfg := LoadJWTConfigFromEnv()
	require.True(t, cfg.AllowUnverified)

	setEnv(t, "SURTOPYA_ENV", "production")
	cfg = LoadJWTConfigFromEnv()
	require.False(t, cfg.AllowUnverified)
}

func TestParseJWTClaims_HS256_Verified(t *testing.T) {
	cfg := JWTConfig{
		Secret:          "secret",
		AllowUnverified: false,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "user-1",
	})
	signed, err := token.SignedString([]byte(cfg.Secret))
	require.NoError(t, err)

	claims, err := ParseJWTClaims(signed, cfg)
	require.NoError(t, err)
	require.Equal(t, "user-1", claims["sub"])
}

func TestParseJWTClaims_HS256_InvalidSignature_ProductionDefaultRejects(t *testing.T) {
	setEnv(t, "SURTOPYA_ENV", "production")
	setEnv(t, "ALLOW_UNVERIFIED_JWT", "")

	cfg := LoadJWTConfigFromEnv()
	cfg.Secret = "right-secret"

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "user-1",
	})
	signed, err := token.SignedString([]byte("wrong-secret"))
	require.NoError(t, err)

	_, err = ParseJWTClaims(signed, cfg)
	require.Error(t, err)
}

func TestParseJWTClaims_HS256_InvalidSignature_AllowUnverifiedParsesClaims(t *testing.T) {
	cfg := JWTConfig{
		Secret:          "right-secret",
		AllowUnverified: true,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "user-1",
	})
	signed, err := token.SignedString([]byte("wrong-secret"))
	require.NoError(t, err)

	claims, err := ParseJWTClaims(signed, cfg)
	require.NoError(t, err)
	require.Equal(t, "user-1", claims["sub"])
}

func TestParseJWTClaims_JWKS_RS256_Verified(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	jwks := map[string]any{
		"keys": []any{
			rsaJWK(t, "test-kid", &privateKey.PublicKey),
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(jwks)
	}))
	t.Cleanup(srv.Close)

	cfg := JWTConfig{
		JWKSURL:         srv.URL,
		AllowUnverified: false,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub": "user-1",
	})
	token.Header["kid"] = "test-kid"
	signed, err := token.SignedString(privateKey)
	require.NoError(t, err)

	claims, err := ParseJWTClaims(signed, cfg)
	require.NoError(t, err)
	require.Equal(t, "user-1", claims["sub"])
}

func rsaJWK(t *testing.T, kid string, pub *rsa.PublicKey) map[string]any {
	t.Helper()
	n := base64.RawURLEncoding.EncodeToString(pub.N.Bytes())

	// e is usually 65537; encode as minimal big-endian bytes.
	eBytes := big.NewInt(int64(pub.E)).Bytes()
	if len(eBytes) == 0 {
		eBytes = []byte{0}
	}
	e := base64.RawURLEncoding.EncodeToString(eBytes)

	return map[string]any{
		"kty": "RSA",
		"use": "sig",
		"alg": "RS256",
		"kid": kid,
		"n":   n,
		"e":   e,
	}
}
