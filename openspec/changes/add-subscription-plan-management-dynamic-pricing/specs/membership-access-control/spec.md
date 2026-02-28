## ADDED Requirements

### Requirement: Admin-managed membership grants with expiry or permanent mode
The system SHALL allow admins with appropriate authority to grant any membership tier to a user as either permanent or expiring membership.

#### Scenario: Admin grants permanent membership
- **WHEN** an authorized admin updates a user membership with `membershipIsPermanent=true`
- **THEN** the backend stores the selected tier
- **AND** stores `is_permanent=true`
- **AND** stores `period_end_at=NULL`

#### Scenario: Admin grants expiring membership
- **WHEN** an authorized admin updates a user membership with `membershipIsPermanent=false` and a future `membershipPeriodEndAt`
- **THEN** the backend stores the selected tier
- **AND** stores `is_permanent=false`
- **AND** stores `period_end_at` with the provided timestamp

#### Scenario: Invalid expiring payload is rejected
- **WHEN** `membershipIsPermanent=false` and `membershipPeriodEndAt` is missing or not in the future
- **THEN** the backend responds with `400`

### Requirement: Membership expiry auto-downgrade
The system SHALL downgrade expired non-permanent memberships to free tier.

#### Scenario: Expired paid membership on authenticated request
- **WHEN** an authenticated user has `is_permanent=false` and `period_end_at <= now`
- **THEN** the backend updates membership to free tier
- **AND** sets `is_permanent=true`
- **AND** sets `period_end_at=NULL`

### Requirement: Subscription plan metadata management
The system SHALL allow authorized admins to create and update subscription plan metadata for pricing display.

#### Scenario: Admin creates plan with pricing metadata
- **WHEN** an authorized admin submits a new subscription plan
- **THEN** the backend persists plan code, i18n name/description, active state, purchasable state, pricing visibility, and USD monthly price

#### Scenario: Non-writer admin cannot mutate plans
- **WHEN** a non-policy-writer admin attempts to create or patch a subscription plan
- **THEN** the backend responds with `403`
