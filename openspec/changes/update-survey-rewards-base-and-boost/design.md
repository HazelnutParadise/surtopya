## Context
The current system includes `questions.points`, but rewards are awarded at completion time using `surveys.points_reward`. This mixes models and creates ambiguity.

We want a single survey-level model:
- system provides a base completion reward
- publishers can spend points to boost rewards with a fixed conversion ratio

## Goals / Non-Goals
- Goals:
  - Remove per-question points configuration (DB + API + UI).
  - On completion, award base points to authenticated respondents.
  - Optional boost: publisher spends `boost_spend_points`, respondent earns `boost_spend_points/3`.
  - Ensure operations are atomic and auditable.
- Non-Goals:
  - Escrow/budget pools for boosting (not requested).
  - Anonymous points wallets (unauthenticated respondents do not earn points).

## Decisions
- Base completion reward is a backend env var: `SURVEY_BASE_POINTS`.
- The existing survey field `surveys.points_reward` is repurposed as **publisher boost spend per completed response** (`boost_spend_points`).
- Boost is applied only for authenticated respondents.
- Boost is best-effort:
  - if publisher has insufficient points at completion time, the response still completes and only base points are awarded.

## Algorithm (Completion)
Given:
- `base = SURVEY_BASE_POINTS`
- `boost_spend = surveys.points_reward`
- `boost_reward = boost_spend / 3`

On completion (authenticated respondent):
1. Award `base` to respondent.
2. If `boost_spend > 0` and publisher has at least `boost_spend` points:
   - deduct `boost_spend` from publisher
   - award `boost_reward` to respondent
3. Persist `responses.points_awarded = base + (boost_applied ? boost_reward : 0)`

## Risks / Trade-offs
- Repurposing `points_reward` changes semantics of existing UIs; mitigated by updating UI copy and specs together.

