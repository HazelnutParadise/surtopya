## 1. Builder Settings Locking

- [x] 1.1 Lock builder Settings view visibility controls when `publishedCount > 0`
- [x] 1.2 Lock builder Settings view dataset sharing switch when `publishedCount > 0`
- [x] 1.3 Add stable `data-testid` attributes for builder settings controls + lock hint
- [x] 1.4 Add i18n key for builder lock hint across locales
- [x] 1.5 Align publish settings dialog controls to respect post-publish locking (disable changes when `publishedCount > 0`)

## 2. Automated Tests

- [x] 2.1 Add Playwright E2E that opens `/create?edit=<id>` with `publishedCount > 0` and asserts builder settings controls are disabled

## 3. Verification

- [x] 3.1 Run `bun run lint`, `bunx vitest run`, and `bun run e2e` in `web/`
- [x] 3.2 Run `openspec validate lock-builder-settings-after-publish --strict`
