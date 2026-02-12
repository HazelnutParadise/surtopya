## Context
We already have repository-level tests for SQL `ORDER BY` clauses and points repository behavior. The missing piece is handler-level tests that prove:
- HTTP status codes match expectations
- authorization rules are enforced
- side effects are gated correctly (no download_count increment on 402)

## Design
Use `httptest` + `gin.TestMode` + `sqlmock`:
- Mock the `datasets` read query used by `DatasetRepository.GetByID`
- For download flows, create a temporary file so the handler takes the "real download" path
- Mock transaction queries used by `PointsRepository.DeductForDatasetTx` and dataset download_count update

## Non-Goals
- End-to-end tests against a real Postgres instance (can be added later).
- Refactors of the handler implementation beyond what is needed for testability.

