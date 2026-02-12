# Capability: Dataset Marketplace

## Purpose
Define dataset listing, sorting, and download enforcement rules (including paid downloads and points).

## Requirements

### Requirement: Dataset Sorting in SQL
The backend SHALL support dataset sorting in the SQL query for `GET /api/v1/datasets`.

#### Scenario: Sort by newest
- **WHEN** the client requests `sort=newest`
- **THEN** datasets are ordered by `created_at DESC`

#### Scenario: Sort by downloads
- **WHEN** the client requests `sort=downloads`
- **THEN** datasets are ordered by `download_count DESC`

#### Scenario: Sort by samples
- **WHEN** the client requests `sort=samples`
- **THEN** datasets are ordered by `sample_size DESC`

### Requirement: Paid Dataset Download Enforces Points
The backend SHALL enforce points checks for paid dataset downloads.

#### Scenario: Paid download requires auth
- **WHEN** an unauthenticated user requests a paid dataset download
- **THEN** the backend responds with 401

#### Scenario: Insufficient points fails without side effects
- **WHEN** an authenticated user with insufficient points requests a paid dataset download
- **THEN** the backend responds with 402
- **AND** the dataset download count is NOT incremented
- **AND** no `points_transactions` row is created

#### Scenario: Successful paid download deducts points
- **WHEN** an authenticated user with sufficient points requests a paid dataset download
- **THEN** the backend deducts points from `users.points_balance`
- **AND** records a `points_transactions` row of type `dataset_purchase` with negative amount
