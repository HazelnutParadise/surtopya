## Why

After a survey is published, the dashboard settings UI still allows toggling visibility (public/non-public) and dataset sharing. The backend rejects republish in some cases, but the UI state is misleading and causes confusion and failed save/publish attempts.

## What Changes

- Lock survey settings that are not allowed to change after the first publish:
  - Visibility (public/non-public) cannot be changed once `published_count > 0`.
  - Dataset sharing cannot be changed once `published_count > 0`.
- Update the dashboard survey settings UI to reflect these locks (disabled controls + explanatory hint).
- Add Playwright E2E coverage to prevent regressions.

## Capabilities

### New Capabilities

- `survey-publish-locks`: Rules and UI expectations for which survey settings are immutable after first publish.

### Modified Capabilities

- (none)

## Impact

- Frontend: `web/src/app/(main)/dashboard/surveys/[id]/page.tsx` settings controls.
- Tests: new Playwright E2E spec under `web/e2e/`.
- No public API contract changes (client-side behavior alignment with existing backend constraints).

