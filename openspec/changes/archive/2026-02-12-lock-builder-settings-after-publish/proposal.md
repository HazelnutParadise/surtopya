## Why

After a survey is published, the survey editor (builder) settings view still allows toggling visibility and dataset sharing. This creates misleading UI states and causes failures when attempting to republish or save settings.

## What Changes

- In the survey builder settings UI, lock visibility and dataset sharing once `published_count > 0`.
- Add an explicit hint in the builder settings view to explain the lock.
- Add Playwright E2E coverage for the builder settings lock behavior.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `survey-publish-locks`: Extend publish-lock requirements to also apply to the survey builder settings UI (not only dashboard settings).

## Impact

- Frontend: `web/src/components/builder/survey-builder.tsx` (settings view + publish dialog controls).
- i18n: `SurveyBuilder` translations for lock hint.
- Tests: new Playwright E2E spec under `web/e2e/`.

