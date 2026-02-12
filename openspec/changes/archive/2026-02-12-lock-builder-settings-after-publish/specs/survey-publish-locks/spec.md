## ADDED Requirements

### Requirement: Builder settings are immutable after first publish
Once a survey has been published at least once (`published_count > 0`), the survey builder settings UI SHALL treat the following settings as immutable:

- Visibility (`public` vs `non-public`)
- Dataset sharing flag (whether the survey's responses can be included in de-identified datasets)

#### Scenario: User opens builder settings for a published survey
- **WHEN** a user opens the survey builder settings view for a survey with `published_count > 0`
- **THEN** the visibility controls SHALL be disabled
- **THEN** the dataset sharing control SHALL be disabled
- **THEN** the UI SHALL display a hint that these settings are locked after publishing

