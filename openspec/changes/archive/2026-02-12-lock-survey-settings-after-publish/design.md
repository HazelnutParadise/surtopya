## Context

The dashboard survey management page (`/dashboard/surveys/[id]`) includes a Settings tab that allows editing survey metadata and publishing configuration. Today, the UI disables switching to `public` after the first publish, but it still allows:

- Switching `public -> non-public` after publish (button remains enabled).
- Toggling dataset sharing for surveys that have been published at least once but were never public.

The backend enforces some immutability rules during publish/re-publish, which leads to confusing UX: users can toggle controls, but saving/publishing may fail.

Constraints:

- Keep changes minimal and localized to the dashboard settings page.
- Preserve Bun-only tooling and existing Playwright mocking style (`page.route("**/api/...")`).

## Goals / Non-Goals

**Goals:**

- After the first publish (`published_count > 0`), lock visibility and dataset sharing controls in the UI.
- Provide a clear, localized hint explaining the lock.
- Add Playwright E2E coverage to assert the locked state.

**Non-Goals:**

- Changing backend validation rules or database schema.
- Refactoring the entire settings page component.
- Redesigning the publishing flow or error envelope.

## Decisions

- Use `survey.settings.publishedCount > 0` as the single source of truth for "published at least once".
  - Rationale: Already present in UI model; matches domain concept used elsewhere.
- Disable both visibility buttons when locked.
  - Alternative considered: only disable the "disallowed" direction. Rejected because user expectation is "published means locked", and partial toggles still mislead.
- Disable dataset sharing switch when locked, in addition to existing lock conditions (`visibility === public` or `everPublic`).
  - Rationale: Prevent editing to a state that cannot be persisted post-publish.
- Add `data-testid` attributes to the affected controls for stable Playwright selectors.

## Risks / Trade-offs

- [Rule mismatch] If backend allows some post-publish changes, UI will be stricter than backend.
  - Mitigation: The product requirement here is to match "published locks settings"; if needed later, relax both UI and spec together.
- [Localization gaps] New hint text requires i18n keys.
  - Mitigation: Add keys to `zh-TW` source and sync `en`/`ja`.

