## Context

Current behavior mixes domain rules and membership checks across multiple places:

- Backend handlers (`survey.go`, `admin.go`, `points_repo.go`) embed direct conditions.
- Frontend (`survey-builder.tsx`, dashboard survey settings page, admin page) duplicates logic.
- Membership state is a single boolean (`users.is_pro`), which cannot represent extensible tier-capability rules.

This change introduces a centralized ACL model while preserving existing high-priority publish immutability (`published_count > 0`).

## Goals / Non-Goals

**Goals**

- Centralize permission decisions in backend policy service.
- Store membership tiers and capabilities in DB, editable from admin UI.
- Provide delegated policy write access for selected admins.
- Preserve post-publish lock behavior.
- Remove `isPro` from API contracts and use `membershipTier + capabilities`.

**Non-Goals**

- Full platform-wide ACL migration for all features in this change.
- Multi-tenant policy scoping.
- Payment/billing integration changes.

## Decisions

- Use a normalized ACL schema:
  - `membership_tiers`, `user_memberships`, `capabilities`, `tier_capabilities`
- Use dedicated `admin_permissions` table for delegated policy writer access (instead of adding a users boolean).
- Track policy writes in `policy_audit_logs` with before/after payload snapshots.
- Introduce policy service methods (`Can`, `ResolveCapabilities`, `ResolveMembershipTier`) and consume them in handlers.
- Keep `published_count > 0` lock as highest precedence in survey settings logic.
- Remove `users.is_pro` in the same migration and backfill memberships from legacy value before drop.

## Data Model

- `membership_tiers`
  - `id`, `code` (unique), `name`, `is_active`, timestamps
- `user_memberships`
  - `user_id` (PK/FK), `tier_id` (FK), timestamps
- `capabilities`
  - `id`, `key` (unique), `name`, `description`, `is_active`, timestamps
- `tier_capabilities`
  - `tier_id`, `capability_id`, `is_allowed`, timestamps, unique (`tier_id`, `capability_id`)
- `admin_permissions`
  - `user_id`, `permission_key`, timestamps, unique (`user_id`, `permission_key`)
- `policy_audit_logs`
  - `id`, `actor_user_id`, `action`, `target_type`, `target_key`, `before_payload`, `after_payload`, timestamps

## API Changes

- `GET /api/v1/me`: add `membershipTier`, `capabilities`; remove `isPro`.
- `GET /api/v1/admin/users`: return `membershipTier`; remove `isPro`.
- `PATCH /api/v1/admin/users/:id`: accept `membershipTier`.
- New endpoints:
  - `GET /api/v1/admin/policies`
  - `PATCH /api/v1/admin/policies`
  - `GET /api/v1/admin/policy-writers`
  - `PUT /api/v1/admin/policy-writers/:id`

## Enforcement Rules

- Capability key: `survey.public_dataset_opt_out`.
- For survey visibility = `public`:
  - if capability disallowed => force `include_in_datasets = true`
  - if capability allowed => honor user-provided value
- If `published_count > 0`:
  - visibility and dataset sharing remain immutable regardless of tier/capability.

## Risks / Trade-offs

- **Breaking API change** (`isPro` removal): requires coordinated frontend/backend deployment.
  - Mitigation: same PR and verification across web/api.
- **Migration risk** with column drop:
  - Mitigation: deterministic backfill from legacy `is_pro`, backup/restore playbook.
- **Permission complexity growth**:
  - Mitigation: capability keys remain explicit and versioned through OpenSpec deltas.

## Migration Plan

1. Create ACL tables and seeds.
2. Backfill user memberships from `users.is_pro`.
3. Update backend to consume membership tables.
4. Update frontend contracts and UI.
5. Drop `users.is_pro`.
6. Validate with tests and OpenSpec strict validation.

## Rollback Notes

- Because `is_pro` is dropped in same migration, rollback requires DB restore or explicit reverse migration script.
- Deployment should include pre-migration DB snapshot.
