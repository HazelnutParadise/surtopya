## 1. Implementation
- [x] 1.1 Add `data-testid` selectors for Datasets controls + cards
- [x] 1.2 Implement Explore pagination (load more fetches next page)
- [x] 1.3 Add `data-testid` selectors for Explore controls + survey cards

## 2. Tests (Playwright)
- [x] 2.1 Add E2E: Datasets sort + pagination
- [x] 2.2 Add E2E: Explore load more pagination

## 3. Spec Updates
- [x] 3.1 Add delta spec: `specs/quality-gates/spec.md`
- [x] 3.2 Update truth spec: `openspec/specs/quality-gates/spec.md`

## 4. Verification
- [x] 4.1 `bun run lint` (0 errors)
- [x] 4.2 `bunx vitest run`
- [x] 4.3 `bun run check:i18n`
- [x] 4.4 `bun run e2e`
- [x] 4.5 `go test ./...`
- [x] 4.6 `openspec validate expand-marketplace-ui-tests --strict`
