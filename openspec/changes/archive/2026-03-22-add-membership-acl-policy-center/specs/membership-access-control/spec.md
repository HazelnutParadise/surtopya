## ADDED Requirements

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
