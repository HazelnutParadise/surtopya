# Delta: Quality Gates

## ADDED Requirements

### Requirement: Dataset Marketplace Handler Regression Tests
The backend SHALL have handler-level regression tests covering key dataset marketplace behaviors.

#### Scenario: Sort ordering is applied for GET /api/v1/datasets
- **WHEN** `GET /api/v1/datasets?sort=downloads` is requested
- **THEN** the handler queries datasets ordered by `download_count DESC`

#### Scenario: Paid download requires auth
- **WHEN** a user requests `POST /api/v1/datasets/:id/download` for a paid dataset without authentication
- **THEN** the handler responds with 401

#### Scenario: Insufficient points returns 402 without side effects
- **WHEN** an authenticated user with insufficient points requests `POST /api/v1/datasets/:id/download` for a paid dataset
- **THEN** the handler responds with 402
- **AND** download_count is NOT incremented

