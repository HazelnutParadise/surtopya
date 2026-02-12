# Change: Increase Backend Coverage for Survey Response Flow

## Why
Survey response start/submit is the core end-user path and the foundation of the points economy. We need handler-level regression tests to prevent breaking:
- response start rules (published/expired)
- completion state transitions
- points awarding and publisher boost behavior

## What Changes
- Add focused Go handler tests for:
  - `POST /api/v1/surveys/:id/responses/start`
  - `POST /api/v1/responses/:id/submit` (completion + points)
- No user-visible behavior changes; this change is test/verification focused.

