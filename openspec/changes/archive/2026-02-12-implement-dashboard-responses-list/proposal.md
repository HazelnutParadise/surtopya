# Change: Dashboard Survey Responses List (Replace Placeholder)

## Why
The dashboard survey detail page currently shows a placeholder for responses analytics. For production readiness, survey owners need to see the collected responses (at least a list with status + timestamps + awarded points) and we need automated UI coverage for it.

## What Changes
- Replace the responses placeholder on `/dashboard/surveys/:id` with a real responses list UI.
- Add a basic client-side export (CSV) entry point.
- Add Playwright E2E coverage for the responses list (mocked API).

