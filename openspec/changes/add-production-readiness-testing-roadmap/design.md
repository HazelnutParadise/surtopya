## Context
Surtopya is a privacy-preserving survey platform with a dataset marketplace. Current codebase has minimal tests, failing lint, and some incomplete business flows.

## Goals
- Establish enforceable quality gates (lint, unit tests, smoke E2E).
- Make core workflows production-complete:
  - Survey response submission persists to backend, awards points, and updates counts.
  - Dataset marketplace sorting and paid downloads are enforced server-side.
- Keep changes backward compatible where feasible.

## Non-Goals
- Full migration of all API payload keys to snake_case (will be handled incrementally).
- Full analytics/BI dashboards (only remove placeholders/blockers; deliver minimal useful views).

## Decisions
- Use Next.js BFF routes (`web/src/app/api/*`) to proxy backend calls and attach auth tokens server-side.
- Implement points awarding and dataset purchases using SQL transactions to avoid partial writes.
- For E2E in CI: use Playwright smoke tests with API mocking to avoid requiring a full backend stack in CI initially.

## Risks / Trade-offs
- Tightening auth/JWT verification and CORS defaults can break local/dev flows.
  - Mitigation: gate stricter behavior by explicit env flags (production-only).
- Transactional changes require careful SQL correctness.
  - Mitigation: add sqlmock-based unit tests for repositories and critical flows.

## Migration Plan
1. Land quality gate improvements first (lint + CI), then core flow implementations.
2. Introduce new error envelope fields while preserving legacy `error` to avoid breaking older clients.
3. Iteratively move endpoints and UI to new flows, keeping backward compatibility until stable.

