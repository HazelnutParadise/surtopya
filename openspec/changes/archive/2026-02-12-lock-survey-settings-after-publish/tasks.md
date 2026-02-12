## 1. Dashboard UI Locking

- [x] 1.1 Add `publishedCount > 0` locking logic to visibility controls on survey settings tab
- [x] 1.2 Add `publishedCount > 0` locking logic to dataset sharing switch on survey settings tab
- [x] 1.3 Add stable `data-testid` attributes for visibility buttons and dataset sharing switch
- [x] 1.4 Display a localized hint explaining settings are locked after first publish

## 2. Automated Tests

- [x] 2.1 Add Playwright E2E test that asserts visibility + dataset sharing controls are disabled when `publishedCount > 0`

## 3. Verification

- [x] 3.1 Run `bun run lint`, `bunx vitest run`, and `bun run e2e` in `web/`
- [x] 3.2 Run `openspec validate lock-survey-settings-after-publish --strict`
