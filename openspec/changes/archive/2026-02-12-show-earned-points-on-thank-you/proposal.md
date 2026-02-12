# Change: Show Earned Points On Survey Thank-You Page

## Why
The thank-you page currently displays a hardcoded points value, which is misleading and breaks the points economy UX.

## What Changes
- Use the response submission result (`pointsAwarded`) to show the actual earned points on the thank-you page.
- Remove the hardcoded points value on the thank-you page.
- Add an E2E test for the "start -> submit -> thank-you" flow (mocked BFF/API).

## Impact
- Affected specs: `survey-response-flow`, `quality-gates`
- Affected code:
  - `web/src/app/survey/[id]/survey-client-page.tsx`
  - `web/src/app/survey/thank-you/page.tsx`
  - `web/e2e/*`

