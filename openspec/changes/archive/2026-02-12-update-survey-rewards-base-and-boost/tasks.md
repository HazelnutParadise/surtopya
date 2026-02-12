## 1. Implementation
- [x] 1.1 Add env config: `SURVEY_BASE_POINTS` (system base reward on completion)
- [x] 1.2 Add DB migration:
  - drop `questions.points`
  - extend `points_transactions.type` to include `survey_boost_spend`
- [x] 1.3 Backend: remove per-question points from models/repository/handlers
- [x] 1.4 Backend: implement completion rewards:
  - award `SURVEY_BASE_POINTS` to authenticated respondent
  - if survey has `points_reward` as boost spend and publisher has enough points: deduct publisher points and award +`boost/3` to respondent
  - persist `responses.points_awarded` as actual awarded amount
- [x] 1.5 Frontend: remove per-question points UI and types/mappers
- [x] 1.6 Frontend: adjust survey-level reward copy to reflect base + boost
- [x] 1.7 Tests:
  - Go unit tests for boost deduction path
  - Update/extend web unit tests if needed

## 2. Spec Updates
- [x] 2.1 Add delta specs:
  - `changes/*/specs/points-economy/spec.md`
  - `changes/*/specs/survey-response-flow/spec.md`
- [x] 2.2 Update truth specs:
  - `openspec/specs/points-economy/spec.md`
  - `openspec/specs/survey-response-flow/spec.md`
- [x] 2.3 Validate OpenSpec: `openspec validate update-survey-rewards-base-and-boost --strict`

## 3. Verification
- [x] 3.1 `openspec validate --all --strict`
- [x] 3.2 `go test ./...`
- [x] 3.3 `bunx vitest run`
- [x] 3.4 `bun run e2e`
