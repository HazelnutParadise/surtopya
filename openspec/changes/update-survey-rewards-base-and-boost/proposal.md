# Change: Survey Rewards Use Survey-Level Base + Publisher Boost (Remove Per-Question Points)

## Why
Per-question points make reward behavior hard to reason about and inconsistent across UI/API. We want a simple, auditable rewards model:
- participants earn a predictable base reward for completing a survey
- publishers can spend points to boost rewards

## What Changes
- Remove per-question points configuration; rewards are survey-level only.
- Introduce a system-wide base completion reward per survey.
- Allow publishers to spend points to boost rewards:
  - publisher spends `boost_spend_points`
  - each eligible respondent earns `boost_spend_points / 3` extra
- Persist the awarded points on the response record and record point movements in `points_transactions`.

## Impact
- Affected specs:
  - `specs/points-economy/spec.md`
  - `specs/survey-response-flow/spec.md`
- Affected code:
  - DB migration removing `questions.points`
  - backend response completion logic (award base + optional boost, deduct publisher points)
  - frontend survey builder UI (remove per-question points input)
  - i18n strings for builder/survey reward display

