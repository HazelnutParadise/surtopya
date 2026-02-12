## 1. Implementation
- [x] 1.1 Add DB migration: `users.pro_points_last_granted_at` + allow `points_transactions.type=pro_monthly_grant`
- [x] 1.2 Add `PointsRepository.GrantProMonthlyPointsIfEligibleTx(...)` (idempotent per user per calendar month)
- [x] 1.3 Invoke Pro monthly grant from `AuthMiddleware` (lazy; best-effort; must not break auth flows)
- [x] 1.4 Extend admin user APIs to read/update `is_pro` (super-admin only)
- [x] 1.5 Add backend tests for monthly grant repository behavior
- [x] 1.6 Add env config docs + compose wiring (`PRO_MONTHLY_POINTS`)

## 2. Spec Updates
- [x] 2.1 Add delta spec `changes/*/specs/points-economy/spec.md`
- [x] 2.2 Promote built state to truth spec `openspec/specs/points-economy/spec.md`
- [x] 2.3 Validate OpenSpec: `openspec validate update-points-economy-pro-monthly-grant --strict`

## 3. Verification
- [x] 3.1 Backend: `go test ./...`
- [x] 3.2 Frontend: `bunx vitest run`
- [x] 3.3 E2E: `bun run e2e`
