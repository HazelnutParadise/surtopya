# Change: Expand Marketplace UI Tests (Explore + Datasets)

## Why
The marketplace surfaces (Explore surveys, Datasets list) have interactive UI flows (sorting, filtering, pagination) that are easy to regress without automated coverage.

## What Changes
- Add stable UI selectors (`data-testid`) for critical marketplace controls/cards.
- Implement real Explore pagination (the current "Load more" button is a placeholder).
- Add Playwright E2E tests for:
  - Datasets: sort + pagination ("Load more").
  - Explore: pagination ("Load more") appends additional cards.
- Update quality gates spec to require these E2E checks.

## Impact
- Affected specs: `quality-gates`
- Affected code:
  - `web/src/app/(main)/datasets/page.tsx`
  - `web/src/app/(main)/explore/page.tsx`
  - `web/src/components/survey-card.tsx`
  - `web/e2e/*`

