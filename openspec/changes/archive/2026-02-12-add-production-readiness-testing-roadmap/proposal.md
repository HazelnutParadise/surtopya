# Change: Production Readiness + Automated Testing Roadmap (6-8 weeks)

## Why
The project currently builds but lacks production-level quality gates, E2E/UI testing, and several core workflow implementations (survey response submission, dataset paid download). We need to ship safely to a public production environment.

## What Changes
- Establish OpenSpec capability deltas for: survey response flow, dataset marketplace, quality gates, security/runtime.
- Add CI workflow quality gates: Go tests, web lint, unit tests, i18n consistency check, and Playwright smoke E2E.
- Implement missing workflow pieces:
  - Survey response submission end-to-end (Next BFF routes + frontend + backend points award).
  - Dataset sorting in SQL and paid download point deduction + transaction recording.
- Reduce runtime production footguns (JWT verification defaults, CORS allowlist behavior) via explicit config.

## Impact
- Affected specs: `survey-response-flow`, `dataset-marketplace`, `quality-gates`, `security-runtime`
- Affected code:
  - Backend: `api/internal/handlers/*`, `api/internal/repository/*`, `api/internal/middleware/*`
  - Frontend: `web/src/app/api/*`, `web/src/app/survey/*`, `web/src/components/*`
  - Tooling: `.github/workflows/*`, `web/scripts/*`

