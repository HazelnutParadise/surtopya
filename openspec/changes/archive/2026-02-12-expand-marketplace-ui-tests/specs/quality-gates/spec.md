## ADDED Requirements

### Requirement: Marketplace Pagination And Sorting UI Smoke Tests
The web project SHALL have E2E tests proving Explore and Datasets marketplace interactions work.

#### Scenario: Datasets list supports sort and pagination
- **WHEN** a user opens `/datasets`
- **AND** the API returns multiple pages of datasets
- **THEN** the UI can change sort order
- **AND** "Load more" appends additional datasets

#### Scenario: Explore supports pagination
- **WHEN** a user opens `/explore`
- **AND** the API returns multiple pages of surveys
- **THEN** "Load more" appends additional surveys

