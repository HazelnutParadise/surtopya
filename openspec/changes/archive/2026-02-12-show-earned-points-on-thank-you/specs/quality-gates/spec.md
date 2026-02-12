## ADDED Requirements

### Requirement: Survey Completion Thank-You UI Smoke Test
The web project SHALL have an E2E test proving the survey completion flow reaches thank-you and shows earned points.

#### Scenario: Thank-you page shows points awarded
- **WHEN** a user starts a survey response and submits answers successfully
- **THEN** the UI navigates to `/survey/thank-you`
- **AND** the UI shows the awarded points

