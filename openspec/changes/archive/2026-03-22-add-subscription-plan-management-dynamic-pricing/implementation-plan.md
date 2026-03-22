# Implementation Plan

## Scope
Implement subscription plan management and dynamic pricing, including admin-controlled membership grant expiry/permanent behavior.

## API Changes
- `PATCH /api/v1/admin/users/:id`: add `membershipPeriodEndAt`, `membershipIsPermanent`
- `GET /api/v1/me`: add membership grant lifecycle fields
- `GET /api/v1/pricing/plans`
- `GET/POST/PATCH /api/v1/admin/subscription-plans`
- `PATCH /api/v1/admin/capabilities/:id`

## Data Model
- `membership_tiers`: i18n + pricing metadata
- `capabilities`: i18n + pricing visibility metadata
- `user_memberships`: lifecycle fields

## Rollout
1. DB migration.
2. Backend policy/handlers/routes.
3. Frontend BFF + admin/pricing UI.
4. Tests and validation.
