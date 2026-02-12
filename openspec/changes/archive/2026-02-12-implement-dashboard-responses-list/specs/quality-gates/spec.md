# Delta: Quality Gates

## ADDED Requirements

### Requirement: Dashboard Survey Responses UI Smoke Test
The web project SHALL have an E2E test proving the dashboard survey detail page can render a responses list.

#### Scenario: Responses list renders on dashboard survey detail
- **WHEN** the survey owner opens `/dashboard/surveys/:id`
- **AND** the API returns at least one response
- **THEN** the UI shows a responses list with status and points awarded

