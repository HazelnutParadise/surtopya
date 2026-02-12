## 1. Implementation
- [x] 1.1 Replace responses placeholder with a real responses list UI
- [x] 1.2 Add CSV export button (client-side)
- [x] 1.3 Add Playwright E2E test for dashboard responses list (mocked)
- [x] 1.4 Add i18n keys for new UI strings and pass i18n check

## 2. Spec Updates
- [x] 2.1 Add delta spec: `specs/quality-gates/spec.md`
- [x] 2.2 Update truth spec: `openspec/specs/quality-gates/spec.md`

## 3. Verification
- [x] 3.1 `bun run lint` (0 errors)
- [x] 3.2 `bunx vitest run`
- [x] 3.3 `bun run check:i18n`
- [x] 3.4 `bun run e2e`
- [x] 3.5 `openspec validate implement-dashboard-responses-list --strict`
