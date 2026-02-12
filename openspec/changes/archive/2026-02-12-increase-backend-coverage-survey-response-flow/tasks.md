## 1. Implementation
- [x] 1.1 Add handler tests: StartResponse creates in_progress response for published survey
- [x] 1.2 Add handler tests: SubmitAllAnswers completes response and awards base points for authenticated user
- [x] 1.3 Add handler tests: SubmitAllAnswers applies publisher boost when eligible
- [x] 1.4 Add handler tests: Anonymous completion awards 0 points

## 2. Spec Updates
- [x] 2.1 Add delta spec: `specs/quality-gates/spec.md`
- [x] 2.2 Update truth spec: `openspec/specs/quality-gates/spec.md`

## 3. Verification
- [x] 3.1 `go test ./... -cover`
- [x] 3.2 `openspec validate increase-backend-coverage-survey-response-flow --strict`
