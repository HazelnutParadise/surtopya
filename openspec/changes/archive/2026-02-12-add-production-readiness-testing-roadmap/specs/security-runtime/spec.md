## ADDED Requirements

### Requirement: Production JWT Verification
The backend SHALL verify JWTs in production using trusted keys (JWKS or configured secret) and SHALL NOT accept unverified JWTs by default.

#### Scenario: Unverified tokens rejected in production mode
- **WHEN** the server runs in production mode
- **AND** `SURTOPYA_ENV=production`
- **AND** a request includes an invalid JWT signature
- **THEN** the request is rejected with 401

#### Configuration
- `ALLOW_UNVERIFIED_JWT` MAY be enabled for development/staging, but MUST default to `false` in production.
- `LOGTO_JWKS_URL` SHOULD be configured in production to verify RS256 tokens.

### Requirement: CORS Allowlist in Production
The backend SHALL restrict CORS to an allowlist in production mode.

#### Scenario: CORS wildcard disabled
- **WHEN** the server runs in production mode with an explicit allowlist (e.g. `ALLOWED_ORIGINS`)
- **THEN** `Access-Control-Allow-Origin` echoes the request `Origin` only when it is allowlisted (never `*` with credentials)
