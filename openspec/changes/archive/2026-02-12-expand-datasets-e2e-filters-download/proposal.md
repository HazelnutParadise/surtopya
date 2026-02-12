# Change: Expand Datasets E2E (Filtering + Download Flows)

## Why
The Datasets marketplace has interactive behaviors (category/search filtering and download flows) that are easy to regress without stable UI selectors and dedicated E2E coverage.

## What Changes
- Add stable `data-testid` selectors for dataset download.
- Add Playwright E2E tests for:
  - Datasets list: category + search filtering results in the correct API query and rendered cards.
  - Dataset detail: free download succeeds, paid download errors on unauthorized, and paid download succeeds when the endpoint returns a file.
- Update quality gates spec to require these E2E checks.

## Impact
- Affected specs: `quality-gates`
- Affected code:
  - `web/src/app/(main)/datasets/[id]/dataset-detail-client.tsx`
  - `web/e2e/*`

