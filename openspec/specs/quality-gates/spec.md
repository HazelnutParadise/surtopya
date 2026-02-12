# Capability: Quality Gates

## Purpose
Define the minimum automated checks that MUST pass before changes are accepted (CI gates).

## Requirements

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

### Requirement: Dataset Marketplace Handler Regression Tests
The backend SHALL have handler-level regression tests covering key dataset marketplace behaviors.

#### Scenario: Sort ordering is applied for GET /api/v1/datasets
- **WHEN** `GET /api/v1/datasets?sort=downloads` is requested
- **THEN** the handler queries datasets ordered by `download_count DESC`

#### Scenario: Paid download requires auth
- **WHEN** a user requests `POST /api/v1/datasets/:id/download` for a paid dataset without authentication
- **THEN** the handler responds with 401

#### Scenario: Insufficient points returns 402 without side effects
- **WHEN** an authenticated user with insufficient points requests `POST /api/v1/datasets/:id/download` for a paid dataset
- **THEN** the handler responds with 402
- **AND** download_count is NOT incremented

### Requirement: Survey Response Flow Handler Regression Tests
The backend SHALL have handler-level regression tests covering key survey response flow behaviors.

#### Scenario: Starting a response for a published survey succeeds
- **WHEN** `POST /api/v1/surveys/:id/responses/start` is called for a published survey
- **THEN** the handler returns 201
- **AND** a response is created with `status=in_progress`

#### Scenario: Completing a response awards points to authenticated users
- **WHEN** `POST /api/v1/responses/:id/submit` is called for an in-progress response with an authenticated user
- **THEN** the handler returns 200
- **AND** `points_awarded` is at least `SURVEY_BASE_POINTS`

#### Scenario: Anonymous completion awards 0 points
- **WHEN** `POST /api/v1/responses/:id/submit` is called for an in-progress response with no authenticated user
- **THEN** the handler returns 200
- **AND** `points_awarded = 0`
