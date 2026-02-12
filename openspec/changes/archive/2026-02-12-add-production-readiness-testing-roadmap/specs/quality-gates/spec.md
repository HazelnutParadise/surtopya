## ADDED Requirements

### Requirement: Web Lint Gate
The web project SHALL pass `bun run lint` with zero errors.

#### Scenario: CI fails on lint errors
- **WHEN** lint errors exist
- **THEN** CI fails the build

### Requirement: Unit Test Gate
The project SHALL run unit tests in CI for both backend and frontend.

#### Scenario: Backend unit tests
- **WHEN** `go test ./...` fails
- **THEN** CI fails

#### Scenario: Frontend unit tests
- **WHEN** `bunx vitest run` fails
- **THEN** CI fails

### Requirement: i18n Consistency Gate
The web project SHALL ensure i18n key consistency across locales.

#### Scenario: Missing translation key
- **WHEN** `en.json` or `ja.json` is missing a key present in `zh-TW.json`
- **THEN** CI fails

### Requirement: E2E Smoke Gate
The web project SHALL run Playwright smoke tests in CI.

#### Scenario: Smoke tests pass
- **WHEN** Playwright tests run
- **THEN** key routes render without crashing
