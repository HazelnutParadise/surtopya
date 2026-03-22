# membership-access-control Specification

## Purpose
TBD - created by archiving change add-membership-acl-policy-center. Update Purpose after archive.
## Requirements
### Requirement: Membership Tier Model
The system SHALL represent membership using tier assignments rather than a boolean Pro flag.

#### Scenario: Resolve user membership tier
- **WHEN** an authenticated user profile is requested
- **THEN** the backend returns a `membershipTier` value
- **AND** the tier is resolved from persisted user membership data

### Requirement: Capability Matrix
The system SHALL evaluate feature access through a tier-capability matrix.

#### Scenario: Resolve capability from tier
- **WHEN** capability `survey.public_dataset_opt_out` is evaluated for a user
- **THEN** the backend determines allowance from the user's tier mapping

### Requirement: Admin Policy Management
The system SHALL expose admin APIs to read and update capability matrix policies.

#### Scenario: Admin reads policy matrix
- **WHEN** an authenticated admin calls `GET /api/v1/admin/policies`
- **THEN** the API returns tiers, capabilities, and allow/deny matrix values

#### Scenario: Authorized writer updates policy matrix
- **WHEN** a super admin or delegated policy writer calls `PATCH /api/v1/admin/policies`
- **THEN** the API updates matrix values
- **AND** persists policy audit logs with actor and before/after payloads

#### Scenario: Unauthorized admin cannot update policy matrix
- **WHEN** an admin without policy-write permission calls `PATCH /api/v1/admin/policies`
- **THEN** the API returns forbidden

### Requirement: Delegated Policy Writers
The system SHALL allow super admins to delegate policy-write access to selected admins.

#### Scenario: Super admin grants policy-write permission
- **WHEN** a super admin calls `PUT /api/v1/admin/policy-writers/:id` with enable=true
- **THEN** the target admin gains `policy.write` permission

#### Scenario: Regular admin can read but not grant
- **WHEN** a non-super admin calls `PUT /api/v1/admin/policy-writers/:id`
- **THEN** the API returns forbidden

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

