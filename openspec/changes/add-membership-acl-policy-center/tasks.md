## 1. OpenSpec Artifacts

- [x] 1.1 Add `proposal.md` describing why, scope, impact
- [x] 1.2 Add `design.md` with architecture, data model, migration strategy
- [x] 1.3 Add `implementation-plan.md` for execution handoff
- [x] 1.4 Add delta specs for `membership-access-control`, `survey-publish-locks`, `points-economy`
- [x] 1.5 Run `openspec validate add-membership-acl-policy-center --strict`

## 2. Database and Migration

- [x] 2.1 Add migration `010_membership_acl.sql`
- [x] 2.2 Create ACL tables: `membership_tiers`, `user_memberships`, `capabilities`, `tier_capabilities`, `admin_permissions`, `policy_audit_logs`
- [x] 2.3 Seed tiers (`free`, `pro`) and capability (`survey.public_dataset_opt_out`)
- [x] 2.4 Seed tier-capability matrix (`free=false`, `pro=true`)
- [x] 2.5 Backfill `user_memberships` from `users.is_pro`
- [x] 2.6 Drop `users.is_pro`

## 3. Backend Policy Layer and Contracts

- [x] 3.1 Add centralized policy service for tier/capability resolution
- [x] 3.2 Add policy writer authorization helper (super admin or delegated `policy.write`)
- [x] 3.3 Update `GET /api/v1/me` response to `membershipTier + capabilities` and remove `isPro`
- [x] 3.4 Update admin user list/update endpoints to read/write `membershipTier`
- [x] 3.5 Add admin policy endpoints: list/update policies, list/update policy writers
- [x] 3.6 Add policy audit log writes for policy matrix changes

## 4. Backend Domain Logic Refactor

- [x] 4.1 Update survey create/update/publish handlers to enforce dataset opt-out via policy service
- [x] 4.2 Preserve `published_count > 0` lock precedence
- [x] 4.3 Update points monthly grant eligibility to membership tier `pro`

## 5. Frontend and BFF

- [x] 5.1 Update frontend API types: remove `isPro`, add `membershipTier` and `capabilities`
- [x] 5.2 Add BFF routes for `/api/admin/policies` and `/api/admin/policy-writers`
- [x] 5.3 Update admin users API payload from `isPro` to `membershipTier`
- [x] 5.4 Add Admin `Policies` tab with capability matrix editor
- [x] 5.5 Add admin delegated policy writers management UI
- [x] 5.6 Replace pro switch in admin users tab with segmented tier selector
- [x] 5.7 Add/replace frontend entitlement helper and wire it into builder + dashboard survey settings

## 6. i18n and Tests

- [x] 6.1 Add i18n keys in `zh-TW` and sync `en`, `ja`
- [x] 6.2 Add backend tests for policy enforcement, admin writer permissions, and membership-tier point grants
- [x] 6.3 Add/update frontend tests for admin policies UI and free/pro survey dataset behavior
- [x] 6.4 Run `go test ./...` in `api/`
- [x] 6.5 Run `bunx vitest run` in `web/`
- [x] 6.6 Run `bun run e2e` in `web/`
- [x] 6.7 Re-run `openspec validate add-membership-acl-policy-center --strict`
