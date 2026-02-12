## 1. OpenSpec Artifacts
- [x] 1.1 Add `openspec/project.md` project conventions
- [x] 1.2 Add change proposal + tasks + design
- [x] 1.3 Add spec deltas under `openspec/changes/.../specs/*`
- [x] 1.4 Validate with `openspec validate add-production-readiness-testing-roadmap --strict`

## 2. Quality Gates + CI
- [x] 2.1 Make `bun run lint` 0 error
- [x] 2.2 Add i18n consistency check script and wire into CI
- [x] 2.3 Add GitHub Actions CI workflow
- [x] 2.4 Add Playwright smoke test harness (config + basic tests)

## 3. Survey Response Flow (End-to-End)
- [x] 3.1 Add Next BFF routes:
  - `POST /api/surveys/[id]/responses/start`
  - `POST /api/responses/[id]/submit`
  - `POST /api/responses/[id]/answers` (optional)
- [x] 3.2 Update survey taking UI to submit answers to backend
- [x] 3.3 Backend: award points + record `points_transactions` on completion
- [x] 3.4 Add unit tests for answer mapping + backend repositories

## 4. Dataset Marketplace (Completeness)
- [x] 4.1 Backend: implement `sort=newest|downloads|samples` in SQL
- [x] 4.2 Backend: paid dataset download checks balance + deducts points + records transaction
- [x] 4.3 Frontend: implement real file download handling (content-disposition, stream/blob)
- [x] 4.4 Add unit tests for dataset download client logic

## 5. Security / Runtime
- [x] 5.1 Add explicit config to control unsafe defaults (JWT unverified, wildcard CORS) in production
- [x] 5.2 Add `/ready` endpoint and DB health check (optional)

## Progress Log
- 2026-02-12:
  - `openspec validate add-production-readiness-testing-roadmap --strict` passes.
  - Backend: `go test ./... -cover` passes.
  - Web: `bun install --frozen-lockfile`, `bunx vitest run`, `bun run build`, `bun run e2e` pass.
  - Web: added unit tests for dataset download filename parsing (`web/src/lib/download.ts`).
  - API: added `/api/v1/ready` readiness endpoint with DB ping.
  - API: production defaults now reject unverified JWT and require explicit CORS allowlist.
