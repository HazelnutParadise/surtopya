## 1. Implementation
- [x] 1.1 Pass `pointsAwarded` from `/api/responses/:id/submit` into thank-you navigation
- [x] 1.2 Update thank-you page to display the passed points (and not a hardcoded value)

## 2. Tests
- [x] 2.1 Add Playwright E2E test: start response -> answer -> submit -> thank-you shows points

## 3. Spec Updates
- [x] 3.1 Add delta spec: `specs/survey-response-flow/spec.md`
- [x] 3.2 Add delta spec: `specs/quality-gates/spec.md`

## 4. Verification
- [x] 4.1 `bun run lint` (0 errors)
- [x] 4.2 `bunx vitest run`
- [x] 4.3 `bun run check:i18n`
- [x] 4.4 `bun run e2e`
- [x] 4.5 `openspec validate show-earned-points-on-thank-you --strict`
