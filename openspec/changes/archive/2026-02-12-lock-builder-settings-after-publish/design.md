## Context

The survey builder (`/create` and `/create?edit=<id>`) includes a Settings view (within `web/src/components/builder/survey-builder.tsx`) and a publish settings dialog. Currently:

- The builder Settings view allows toggling visibility and dataset sharing even when `published_count > 0`.
- The publish dialog only blocks switching to public in one direction (`non-public -> public`) after publish, but does not fully lock post-publish settings.

This does not match the expected immutability rules after first publish and is inconsistent with the dashboard settings page behavior.

## Goals / Non-Goals

**Goals:**

- In builder Settings view and publish dialog, disable visibility + dataset sharing controls when `published_count > 0`.
- Add an explanatory hint in builder Settings view.
- Add Playwright E2E coverage to prevent regressions.

**Non-Goals:**

- Backend changes to publish rules.
- Large refactor of the monolithic `survey-builder.tsx`.
- Changing the general publish/save API contracts.

## Decisions

- Use `publishedCount > 0` as the lock condition, consistent with the dashboard page.
- Add stable `data-testid` attributes for Playwright selectors:
  - Builder settings visibility buttons
  - Builder settings dataset sharing switch
  - Builder lock hint
  - Optional: settings tab toggle button if needed for navigation in tests
- Keep existing forced-true dataset sharing behavior for public surveys / ever-public surveys, but make it additionally locked after first publish.

## Risks / Trade-offs

- [UX consistency] Users may still reach the builder with an old cached state.
  - Mitigation: lock is derived from server-loaded `publishedCount` when editing; controls remain disabled.
- [Test fragility] Builder UI selectors are currently not stable.
  - Mitigation: add `data-testid` attributes and rely on them in Playwright.

