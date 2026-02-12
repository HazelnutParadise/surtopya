## Context
We have specs defining response start/submit behavior and the points economy. Current tests cover some repository logic with `sqlmock`, but we lack handler-level tests proving end-to-end handler orchestration:
- locking response rows
- completing responses and incrementing survey stats
- awarding base points and optional publisher boost

## Design
Use `httptest` + `gin.TestMode` + `sqlmock`:
- For StartResponse: mock survey fetch + question list + response insert
- For SubmitAllAnswers: mock the response lock query + survey fetch + tx updates + points transactions + response reload

## Non-Goals
- Full integration tests against a real Postgres instance (can follow later).
- UI tests (already covered separately by Playwright smoke tests).

