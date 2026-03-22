# Implementation Plan: Membership ACL + Policy Management Center

## Objective

Implement a database-driven membership ACL system with centralized policy enforcement and admin policy management UI. Replace legacy `is_pro` with `membershipTier + capabilities`, while keeping post-publish survey locks intact.

## Scope

- Full-stack implementation in one rollout:
  - DB migration + backfill + legacy column removal
  - Backend policy service and API changes
  - Frontend BFF and admin UI changes
  - Tests and OpenSpec validation

## Locked Product Rules

1. `free` users cannot opt out of dataset plan when survey visibility is `public`.
2. `pro` users can opt out of dataset plan when survey visibility is `public` (before publish lock).
3. `published_count > 0` lock remains highest priority and blocks visibility/dataset sharing changes for all tiers.
4. Policy changes must be audited.
5. Admin policy write access:
   - readable by all admins
   - writable by super admins and delegated policy writers.

## API Contract Targets

- `GET /api/v1/me`:
  - remove `isPro`
  - include `membershipTier`
  - include `capabilities` map (must include `survey.public_dataset_opt_out`)
- `GET /api/v1/admin/users`:
  - include `membershipTier`
  - remove `isPro`
- `PATCH /api/v1/admin/users/:id`:
  - update `membershipTier`
- Add:
  - `GET/PATCH /api/v1/admin/policies`
  - `GET /api/v1/admin/policy-writers`
  - `PUT /api/v1/admin/policy-writers/:id`

## Data Model

- `membership_tiers`
- `user_memberships`
- `capabilities`
- `tier_capabilities`
- `admin_permissions`
- `policy_audit_logs`

Seed data:
- tiers: `free`, `pro`
- capability: `survey.public_dataset_opt_out`
- matrix: `free=false`, `pro=true`

Backfill:
- `users.is_pro = true` => `pro`
- else => `free`

Then drop `users.is_pro`.

## Implementation Order

1. OpenSpec artifacts + strict validation.
2. DB migration and model/repository groundwork.
3. Backend policy service + handler/routing updates.
4. Frontend type/BFF updates.
5. Admin page policies tab + tier selector refactor.
6. Builder/dashboard entitlement helper refactor.
7. i18n synchronization.
8. Automated tests + final validation.

## Verification Matrix

- Backend
  - free/public forces dataset sharing on
  - pro/public can opt out before publish lock
  - post-publish lock blocks setting changes for all tiers
  - policy writer authorization enforced
  - policy updates create audit records
  - monthly pro grant keyed by membership tier
- Frontend
  - admin users tier selector updates membership tier
  - policies tab matrix read/update works
  - delegated policy writers management works
  - builder/dashboard follow entitlement helper outcomes

## Commands

- `openspec validate add-membership-acl-policy-center --strict`
- `go test ./...` (in `api/`)
- `bunx vitest run` (in `web/`)
- `bun run e2e` (in `web/`)
