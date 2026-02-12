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
Completing a survey MUST award the survey's `points_reward` to the respondent when the response transitions to `completed`.

#### Scenario: Authenticated user earns points on completion
- **WHEN** an authenticated user submits a completed response for a survey with `points_reward > 0`
- **THEN** the backend increments `users.points_balance` by `points_reward`
- **AND** records a `points_transactions` row of type `survey_reward`

#### Scenario: Anonymous user does not earn points
- **WHEN** an anonymous user submits a completed response
- **THEN** no points are awarded

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
Pro users (`users.is_pro = true`) MUST receive a monthly base points grant, applied lazily on the first authenticated request in each calendar month.

#### Scenario: Eligible Pro user receives monthly grant once per month
- **WHEN** a Pro user makes their first authenticated request in a calendar month
- **THEN** the backend increments `users.points_balance` by `PRO_MONTHLY_POINTS`
- **AND** sets `users.pro_points_last_granted_at` to the grant timestamp
- **AND** records a `points_transactions` row of type `pro_monthly_grant`

#### Scenario: Pro user does not receive the grant twice in the same month
- **WHEN** a Pro user makes multiple authenticated requests within the same calendar month
- **THEN** the backend grants `PRO_MONTHLY_POINTS` at most once

#### Scenario: Non-Pro user never receives Pro monthly grants
- **WHEN** a non-Pro user makes authenticated requests
- **THEN** no `pro_monthly_grant` transaction is created

