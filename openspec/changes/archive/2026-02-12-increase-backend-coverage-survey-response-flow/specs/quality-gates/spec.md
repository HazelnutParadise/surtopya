# Delta: Quality Gates

## ADDED Requirements

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

