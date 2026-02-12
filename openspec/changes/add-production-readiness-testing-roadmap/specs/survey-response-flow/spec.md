## ADDED Requirements

### Requirement: Survey Response Submission End-to-End
The system SHALL persist survey responses to the backend API and return a completion result.

#### Scenario: Anonymous user completes a survey
- **WHEN** an anonymous user starts a response
- **THEN** the backend returns a `response_id` with status `in_progress`
- **WHEN** the user submits answers for the `response_id`
- **THEN** the backend marks the response as `completed`
- **AND** the UI navigates to the thank-you page

#### Scenario: Authenticated user completes a survey and earns points
- **WHEN** an authenticated user submits a completed response
- **THEN** the backend awards `points_reward` to the user's `points_balance`
- **AND** records a `points_transactions` row of type `survey_reward`

### Requirement: Next.js BFF Proxy Routes for Response Submission
The web application SHALL expose proxy routes for response submission under `/api/*`.

#### Scenario: Start response via BFF
- **WHEN** the client calls `POST /api/surveys/:id/responses/start`
- **THEN** the BFF proxies to `POST /api/v1/surveys/:id/responses/start`

#### Scenario: Submit response via BFF
- **WHEN** the client calls `POST /api/responses/:id/submit`
- **THEN** the BFF proxies to `POST /api/v1/responses/:id/submit`

