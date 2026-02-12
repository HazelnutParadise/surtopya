## ADDED Requirements

### Requirement: Dataset Filtering And Download UI Smoke Tests
The web project SHALL have E2E tests proving dataset filtering and download flows work.

#### Scenario: Datasets filtering updates results
- **WHEN** a user opens `/datasets`
- **AND** the user changes category and search query
- **THEN** the UI requests `/api/datasets` with corresponding `category` and `search` parameters
- **AND** the rendered dataset cards match the filtered results

#### Scenario: Dataset download flows work for free and paid datasets
- **WHEN** a user opens a dataset detail page and downloads a free dataset
- **THEN** a file download is triggered
- **WHEN** a user downloads a paid dataset while unauthorized
- **THEN** the UI shows an error message

