## 1. OpenSpec Artifacts
- [ ] 1.1 Add `openspec/project.md` project conventions
- [ ] 1.2 Add change proposal + tasks + design
- [ ] 1.3 Add spec deltas under `openspec/changes/.../specs/*`
- [ ] 1.4 Validate with `openspec validate add-production-readiness-testing-roadmap --strict`

## 2. Quality Gates + CI
- [ ] 2.1 Make `bun run lint` 0 error
- [ ] 2.2 Add i18n consistency check script and wire into CI
- [ ] 2.3 Add GitHub Actions CI workflow
- [ ] 2.4 Add Playwright smoke test harness (config + basic tests)

## 3. Survey Response Flow (End-to-End)
- [ ] 3.1 Add Next BFF routes:
  - `POST /api/surveys/[id]/responses/start`
  - `POST /api/responses/[id]/submit`
  - `POST /api/responses/[id]/answers` (optional)
- [ ] 3.2 Update survey taking UI to submit answers to backend
- [ ] 3.3 Backend: award points + record `points_transactions` on completion
- [ ] 3.4 Add unit tests for answer mapping + backend repositories

## 4. Dataset Marketplace (Completeness)
- [ ] 4.1 Backend: implement `sort=newest|downloads|samples` in SQL
- [ ] 4.2 Backend: paid dataset download checks balance + deducts points + records transaction
- [ ] 4.3 Frontend: implement real file download handling (content-disposition, stream/blob)
- [ ] 4.4 Add unit tests for dataset download client logic

## 5. Security / Runtime
- [ ] 5.1 Add explicit config to control unsafe defaults (JWT unverified, wildcard CORS) in production
- [ ] 5.2 Add `/ready` endpoint and DB health check (optional)
