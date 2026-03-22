# pricing-experience Specification

## Purpose
TBD - created by archiving change add-subscription-plan-management-dynamic-pricing. Update Purpose after archive.
## Requirements
### Requirement: Pricing page is driven by subscription plan settings
The system SHALL provide a public pricing API whose output is fully derived from subscription plan and capability settings.

#### Scenario: Pricing plans list only visible active plans
- **WHEN** a client calls `GET /api/v1/pricing/plans?locale=en`
- **THEN** only plans with `is_active=true` and `show_on_pricing=true` are returned

#### Scenario: Plan pricing uses USD monthly fields
- **WHEN** a visible plan is returned
- **THEN** it includes `priceCentsUsd`
- **AND** includes `currency=USD`
- **AND** includes `billingInterval=month`

### Requirement: Pricing benefits follow capability matrix
The system SHALL render plan benefits from enabled capabilities for each tier.

#### Scenario: Capability hidden from pricing is not listed
- **WHEN** a capability has `show_on_pricing=false`
- **THEN** it is excluded from pricing benefits even if the tier allows it

#### Scenario: Tier capability allowed appears as benefit
- **WHEN** a capability has `show_on_pricing=true` and tier matrix `isAllowed=true`
- **THEN** it appears in that plan's `benefits` list

