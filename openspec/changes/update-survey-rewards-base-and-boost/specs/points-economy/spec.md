## MODIFIED Requirements

### Requirement: Completing Surveys Earns Points
Completing a survey MUST award points to the respondent when the response transitions to `completed`.

#### Scenario: Authenticated user earns base points on completion
- **WHEN** an authenticated user submits a completed response
- **THEN** the backend awards `SURVEY_BASE_POINTS` to the user's `points_balance`
- **AND** records a `points_transactions` row of type `survey_reward`

#### Scenario: Publisher boost spend increases respondent reward
- **WHEN** an authenticated user submits a completed response for a survey with `boost_spend_points > 0`
- **AND** the publisher has at least `boost_spend_points` points
- **THEN** the backend deducts `boost_spend_points` from the publisher's `points_balance`
- **AND** awards the respondent an additional `boost_spend_points/3` points
- **AND** records a `points_transactions` row of type `survey_boost_spend` for the publisher

#### Scenario: Boost is skipped when publisher has insufficient points
- **WHEN** an authenticated user submits a completed response for a survey with `boost_spend_points > 0`
- **AND** the publisher has insufficient points
- **THEN** the response still completes successfully
- **AND** only `SURVEY_BASE_POINTS` are awarded

#### Scenario: Anonymous user does not earn points
- **WHEN** an anonymous user submits a completed response
- **THEN** no points are awarded

### Requirement: Question-Level Points Are Not Used
The system MUST NOT support per-question points for reward calculation.

#### Scenario: Survey builder does not expose question points
- **WHEN** a publisher edits survey questions
- **THEN** no per-question points setting is available

