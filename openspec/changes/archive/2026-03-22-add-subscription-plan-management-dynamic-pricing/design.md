## Context

The project already introduced tier-capability ACL primitives in a previous change. This follow-up change upgrades those primitives into a full subscription plan management center with dynamic pricing and explicit membership grant lifecycles.

## Goals

- Centralize plan metadata in DB.
- Let admins create/update/deactivate plans and set USD monthly pricing + pricing visibility.
- Let admins grant memberships with either fixed expiry or permanent state.
- Keep capability-based entitlements as source of truth for benefits.
- Render `/pricing` from DB data only.

## Non-Goals

- Payment integration / checkout.
- Recurring billing jobs and invoice lifecycle.

## Decisions

- Keep `membership_tiers` as canonical plan table; extend it with i18n + pricing fields.
- Extend `user_memberships` with `period_end_at` and `is_permanent`.
- Backfill legacy `pro` grants to 30-day non-permanent grants.
- Enforce membership expiry lazily on authenticated requests.
- Use capability matrix (`tier_capabilities`) to compute pricing benefits.

## Risks / Trade-offs

- Lazy expiry enforcement may delay downgrade until next authenticated request.
- Existing active change for ACL is not yet archived; this change still validates independently with delta specs.

## Migration Plan

1. Add migration `011_subscription_plan_management.sql`.
2. Backfill i18n fields and membership expiry/permanent fields.
3. Deploy backend API + policy logic.
4. Deploy frontend admin/pricing updates.
5. Run full validation and tests.
