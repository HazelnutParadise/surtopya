## Context
The page `web/src/app/(main)/dashboard/surveys/[id]/page.tsx` already fetches:
- `/api/surveys/:id` (survey detail)
- `/api/surveys/:id/responses` (responses list)

But the UI still renders a placeholder in the "Responses" tab.

## Design
- Render an empty state when no responses are present.
- Render a table/list when responses exist, showing:
  - status
  - submitted timestamp (completed_at if present, else created_at)
  - points_awarded
  - respondent identifier (userId or anonymousId)
- Provide an "Export CSV" button that exports the already-loaded responses.
- Add stable selectors (`data-testid`) for Playwright.

## Non-Goals
- Full analytics/aggregation charts.
- Server-side export endpoint (client-side export is sufficient for now).

