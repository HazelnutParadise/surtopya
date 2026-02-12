## ADDED Requirements

### Requirement: Production JWT Verification
The backend SHALL verify JWTs in production using trusted keys (JWKS or configured secret) and SHALL NOT accept unverified JWTs by default.

#### Scenario: Unverified tokens rejected in production mode
- **WHEN** the server runs in production mode
- **AND** a request includes an invalid JWT signature
- **THEN** the request is rejected with 401

### Requirement: CORS Allowlist in Production
The backend SHALL restrict CORS to an allowlist in production mode.

#### Scenario: CORS wildcard disabled
- **WHEN** the server runs with `ALLOWED_ORIGIN` set to a specific origin
- **THEN** `Access-Control-Allow-Origin` is that origin (not `*`)

