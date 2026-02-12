# survey-publish-locks Specification

## Purpose
TBD - created by archiving change lock-survey-settings-after-publish. Update Purpose after archive.
## Requirements
### Requirement: Survey settings are immutable after first publish
Once a survey has been published at least once (`published_count > 0`), the system SHALL treat the following settings as immutable in the dashboard settings UI:

- Visibility (`public` vs `non-public`)
- Dataset sharing flag (whether the survey's responses can be included in de-identified datasets)

#### Scenario: User views settings for a published survey
- **WHEN** a user opens the dashboard settings tab for a survey with `published_count > 0`
- **THEN** the visibility controls SHALL be disabled
- **THEN** the dataset sharing control SHALL be disabled
- **THEN** the UI SHALL display a hint that these settings are locked after publishing

### Requirement: UI prevents invalid toggles pre-save
The dashboard settings UI MUST prevent users from changing locked values client-side so they do not reach a save/publish attempt in an invalid state.

#### Scenario: User attempts to toggle visibility after publish
- **WHEN** a user attempts to click the visibility toggle for a survey with `published_count > 0`
- **THEN** the UI SHALL not change the selected visibility value

#### Scenario: User attempts to toggle dataset sharing after publish
- **WHEN** a user attempts to toggle dataset sharing for a survey with `published_count > 0`
- **THEN** the UI SHALL not change the dataset sharing value

