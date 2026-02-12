package middleware

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWTConfig struct {
	AllowUnverified bool
	Secret          string

	// If set, tokens are verified using RS256 against this JWKS endpoint.
	JWKSURL  string
	Issuer   string
	Audience string
}

func LoadJWTConfigFromEnv() JWTConfig {
	allowUnverified := envBoolWithProductionDefault("ALLOW_UNVERIFIED_JWT", true, false)

	secret := os.Getenv("JWT_SECRET")
	if secret == "" && !isProductionEnv() {
		secret = "development-secret-key"
	}

	return JWTConfig{
		AllowUnverified: allowUnverified,
		Secret:          secret,
		JWKSURL:         os.Getenv("LOGTO_JWKS_URL"),
		Issuer:          os.Getenv("LOGTO_ISSUER"),
		Audience:        os.Getenv("LOGTO_AUDIENCE"),
	}
}

func ParseJWTClaims(tokenString string, cfg JWTConfig) (jwt.MapClaims, error) {
	var opts []jwt.ParserOption
	if cfg.Issuer != "" {
		opts = append(opts, jwt.WithIssuer(cfg.Issuer))
	}
	if cfg.Audience != "" {
		opts = append(opts, jwt.WithAudience(cfg.Audience))
	}

	if cfg.JWKSURL != "" {
		parser := jwt.NewParser(append(opts, jwt.WithValidMethods([]string{"RS256"}))...)
		token, err := parser.Parse(tokenString, func(token *jwt.Token) (any, error) {
			kid, _ := token.Header["kid"].(string)
			if kid == "" {
				return nil, errors.New("missing kid")
			}

			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()

			keys, err := getRSAPublicKeysFromJWKS(ctx, cfg.JWKSURL)
			if err != nil {
				return nil, err
			}
			key := keys[kid]
			if key == nil {
				return nil, fmt.Errorf("unknown kid: %s", kid)
			}
			return key, nil
		})
		if err != nil || token == nil || !token.Valid {
			if cfg.AllowUnverified {
				return parseUnverifiedClaims(tokenString)
			}
			if err == nil {
				err = errors.New("invalid token")
			}
			return nil, err
		}
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return nil, errors.New("invalid token claims")
		}
		return claims, nil
	}

	// Fallback: HMAC verification (dev/local).
	parser := jwt.NewParser(append(opts, jwt.WithValidMethods([]string{"HS256"}))...)
	token, err := parser.Parse(tokenString, func(token *jwt.Token) (any, error) {
		if cfg.Secret == "" {
			return nil, errors.New("missing JWT secret")
		}
		return []byte(cfg.Secret), nil
	})
	if err != nil || token == nil || !token.Valid {
		if cfg.AllowUnverified {
			return parseUnverifiedClaims(tokenString)
		}
		if err == nil {
			err = errors.New("invalid token")
		}
		return nil, err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}

func parseUnverifiedClaims(tokenString string) (jwt.MapClaims, error) {
	parser := jwt.NewParser()
	unverifiedToken, _, err := parser.ParseUnverified(tokenString, jwt.MapClaims{})
	if err != nil {
		return nil, err
	}
	claims, ok := unverifiedToken.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}

func isProductionEnv() bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv("SURTOPYA_ENV")))
	return v == "production" || v == "prod"
}

func envBoolWithProductionDefault(key string, defaultNonProd bool, defaultProd bool) bool {
	raw, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(raw) == "" {
		if isProductionEnv() {
			return defaultProd
		}
		return defaultNonProd
	}
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		if isProductionEnv() {
			return defaultProd
		}
		return defaultNonProd
	}
}

type jwksPayload struct {
	Keys []jwkKey `json:"keys"`
}

type jwkKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jwksCacheEntry struct {
	fetchedAt time.Time
	keys      map[string]*rsa.PublicKey
}

var (
	jwksCache    sync.Map // map[string]jwksCacheEntry
	jwksCacheTTL = 5 * time.Minute
)

func getRSAPublicKeysFromJWKS(ctx context.Context, url string) (map[string]*rsa.PublicKey, error) {
	if v, ok := jwksCache.Load(url); ok {
		entry := v.(jwksCacheEntry)
		if time.Since(entry.fetchedAt) < jwksCacheTTL {
			return entry.keys, nil
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("jwks fetch failed: %s", resp.Status)
	}

	var payload jwksPayload
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	keys := make(map[string]*rsa.PublicKey, len(payload.Keys))
	for _, k := range payload.Keys {
		if strings.ToUpper(k.Kty) != "RSA" || k.Kid == "" || k.N == "" || k.E == "" {
			continue
		}

		nb, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eb, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}
		e := 0
		for _, b := range eb {
			e = (e << 8) | int(b)
		}
		if e == 0 {
			continue
		}

		keys[k.Kid] = &rsa.PublicKey{
			N: new(big.Int).SetBytes(nb),
			E: e,
		}
	}

	jwksCache.Store(url, jwksCacheEntry{fetchedAt: time.Now(), keys: keys})
	return keys, nil
}
