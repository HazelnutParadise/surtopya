# Capability: Points Economy

## Purpose
Define how points are earned and spent across surveys, datasets, and Pro membership.
## Requirements
### Requirement: Publishing Surveys Costs 0 Points
Publishing a survey MUST NOT deduct points from the publisher.

#### Scenario: First publish does not change points balance
- **WHEN** an authenticated user publishes a survey
- **THEN** the publisher's `users.points_balance` is unchanged
- **AND** no `points_transactions` row is created for publishing

### Requirement: Completing Surveys Earns Points
Completing a survey MUST award points to the respondent when the response transitions to `completed`.

#### Scenario: Authenticated user earns base points on completion
- **WHEN** an authenticated user submits a completed response
- **THEN** the backend increments `users.points_balance` by `SURVEY_BASE_POINTS`
- **AND** records a `points_transactions` row of type `survey_reward`

#### Scenario: Publisher boost spend increases respondent reward
- **WHEN** an authenticated user submits a completed response for a survey with `boost_spend_points > 0` (stored as `surveys.points_reward`)
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

### Requirement: Points Can Purchase Paid Datasets
Paid dataset downloads MUST be gated by points balance and recorded as a transaction.

#### Scenario: Paid dataset download deducts points
- **WHEN** an authenticated user downloads a paid dataset with sufficient points
- **THEN** the backend deducts `datasets.price` from `users.points_balance`
- **AND** records a `points_transactions` row of type `dataset_purchase` with negative amount

#### Scenario: Free dataset download does not deduct points
- **WHEN** an authenticated user downloads a free dataset
- **THEN** no points are deducted

### Requirement: Pro Members Receive Monthly Base Points (Lazy Grant)
Users with membership tier `pro` MUST receive a monthly base points grant, applied lazily on the first authenticated request in each calendar month.

#### Scenario: Eligible pro-tier user receives monthly grant once per month
- **WHEN** a pro-tier user makes their first authenticated request in a calendar month
- **THEN** the backend increments `users.points_balance` by `PRO_MONTHLY_POINTS`
- **AND** sets `users.pro_points_last_granted_at` to the grant timestamp
- **AND** records a `points_transactions` row of type `pro_monthly_grant`

#### Scenario: Pro-tier user does not receive the grant twice in the same month
- **WHEN** a pro-tier user makes multiple authenticated requests within the same calendar month
- **THEN** the backend grants `PRO_MONTHLY_POINTS` at most once

#### Scenario: Non-pro-tier user never receives Pro monthly grants
- **WHEN** a non-pro-tier user makes authenticated requests
- **THEN** no `pro_monthly_grant` transaction is created

