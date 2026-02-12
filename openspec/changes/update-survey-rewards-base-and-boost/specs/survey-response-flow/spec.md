## MODIFIED Requirements

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
- **THEN** the backend awards points using the points economy rules
- **AND** persists `responses.points_awarded` as the awarded amount

