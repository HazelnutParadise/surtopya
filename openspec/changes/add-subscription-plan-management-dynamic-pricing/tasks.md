## 1. OpenSpec
- [x] 1.1 Create change `add-subscription-plan-management-dynamic-pricing`
- [x] 1.2 Add proposal/design/tasks/implementation-plan documents
- [x] 1.3 Add delta specs for membership access control and pricing experience
- [x] 1.4 Validate with `openspec validate add-subscription-plan-management-dynamic-pricing --strict`

## 2. Database
- [x] 2.1 Add migration `011_subscription_plan_management.sql`
- [x] 2.2 Extend `membership_tiers` with i18n + pricing fields
- [x] 2.3 Extend `capabilities` with i18n + pricing visibility fields
- [x] 2.4 Extend `user_memberships` with `started_at`, `period_end_at`, `is_permanent`
- [x] 2.5 Backfill existing `pro` memberships to 30-day non-permanent grants

## 3. Backend
- [x] 3.1 Add policy service methods for plan CRUD and membership grants
- [x] 3.2 Add expiry downgrade logic and run before monthly points grant
- [x] 3.3 Update `/api/v1/me` with membership period/permanent fields
- [x] 3.4 Update `/api/v1/admin/users/:id` to accept grant payload
- [x] 3.5 Add admin subscription plan endpoints
- [x] 3.6 Add admin capability display setting endpoint
- [x] 3.7 Add public pricing plans endpoint

## 4. Frontend
- [x] 4.1 Add BFF routes for pricing plans and admin subscription plan APIs
- [x] 4.2 Update admin users tab with dynamic tiers + expiry/permanent controls
- [x] 4.3 Add admin plans management section
- [x] 4.4 Add capability i18n/pricing visibility editing in admin policies section
- [x] 4.5 Rewrite `/pricing` to consume `/api/pricing/plans`

## 5. Tests & Validation
- [x] 5.1 Add backend policy tests for membership grant validation + expiry downgrade
- [x] 5.2 Update frontend e2e for new admin membership grant payload
- [x] 5.3 Add pricing page e2e contract test
- [x] 5.4 Run `openspec validate add-subscription-plan-management-dynamic-pricing --strict`
- [x] 5.5 Run `go test ./...`
- [x] 5.6 Run `bunx vitest run`
- [x] 5.7 Run `bun run e2e`
