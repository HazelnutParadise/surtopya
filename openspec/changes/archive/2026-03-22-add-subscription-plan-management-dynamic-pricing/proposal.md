# Change: Subscription Plan Management + Dynamic Pricing

## Why

Current pricing plans are hardcoded in the frontend and membership grant logic cannot represent explicit expiry/permanent grants managed by admins. We need database-driven subscription plan management and pricing rendering, with membership grant expiry controls.

## What Changes

- Add subscription plan management on top of `membership_tiers` (active state, purchasable flag, pricing visibility, USD monthly pricing, i18n name/description).
- Add membership grant controls for admins: assign tier with either expiry timestamp or permanent grant.
- Add capability i18n + pricing visibility management.
- Add public pricing plans API driven by DB policies and tier-capability matrix.
- Update `/pricing` page to render plans and benefits dynamically.
- Add automatic expiry downgrade to free tier for expired non-permanent memberships.

## Impact

- Affected specs:
  - `membership-access-control`
  - `pricing-experience` (new)
- Affected code:
  - `api/migrations`
  - `api/internal/policy`
  - `api/internal/handlers`
  - `api/internal/middleware`
  - `api/internal/routes`
  - `web/src/app/(main)/admin/page.tsx`
  - `web/src/app/(main)/pricing/page.tsx`
  - `web/src/app/api/*`
