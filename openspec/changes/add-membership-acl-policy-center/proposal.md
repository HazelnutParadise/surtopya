# Change: Membership ACL + Policy Management Center

## Why

Membership-based permission logic is currently scattered across frontend components and backend handlers, mainly via `users.is_pro` checks and inline conditionals. This makes behavior hard to maintain, audit, and extend. We need a centralized, database-driven permission model with an admin policy management interface.

## What Changes

- Introduce a membership ACL data model (tiers, capabilities, tier-capability matrix, user memberships).
- Add admin policy management APIs and UI for:
  - Editing capability matrix (`tier x capability`)
  - Managing delegated policy writers (non-super admins with policy write permission)
- Migrate from `users.is_pro` to membership tiers and remove `is_pro` from API contracts.
- Add policy audit logging for all policy matrix updates.
- Enforce survey dataset opt-out behavior via centralized policy service:
  - `free`: public surveys must stay in dataset plan
  - `pro`: public surveys may opt out before publish lock
- Preserve post-publish lock rule: `published_count > 0` remains highest-priority lock.

## Capabilities

### New Capabilities

- `membership-access-control`: Membership tiers, capability matrix, delegated policy writers, and policy audit logs.

### Modified Capabilities

- `survey-publish-locks`: Add tier-aware dataset opt-out rules while preserving publish lock.
- `points-economy`: Replace Pro eligibility source from `users.is_pro` to membership tier (`pro`).

## Impact

- Database: new ACL tables + backfill + removal of `users.is_pro`.
- Backend:
  - new policy service layer
  - updated user/admin/survey handlers and routes
  - updated points grant eligibility
- Frontend:
  - updated profile/admin types and BFF routes
  - new Admin Policies tab and policy writer management
  - consolidated entitlement helper used by builder + dashboard settings
- Tests:
  - backend policy enforcement and auth/authorization tests
  - frontend admin policies and tier UI tests
  - survey behavior tests for free/pro policy outcomes
