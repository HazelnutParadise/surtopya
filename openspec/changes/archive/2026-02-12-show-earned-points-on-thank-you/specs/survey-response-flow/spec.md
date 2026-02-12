## MODIFIED Requirements

### Requirement: Survey Response Submission End-to-End
The system SHALL persist survey responses to the backend API and return a completion result.

#### Scenario: Authenticated user completes a survey and sees earned points
- **WHEN** an authenticated user submits a completed response
- **THEN** the backend returns `pointsAwarded`
- **AND** the UI navigates to the thank-you page
- **AND** the thank-you page displays the earned points

