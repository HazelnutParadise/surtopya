## 1. Implementation
- [x] 1.1 Add handler tests: dataset sorting (newest/downloads/samples)
- [x] 1.2 Add handler tests: paid download requires auth (401)
- [x] 1.3 Add handler tests: insufficient points returns 402 with no side effects
- [x] 1.4 Add handler tests: successful paid download deducts points, increments download_count, returns attachment

## 2. Spec Updates
- [x] 2.1 Add delta spec: `specs/quality-gates/spec.md`
- [x] 2.2 Update truth spec: `openspec/specs/quality-gates/spec.md`

## 3. Verification
- [x] 3.1 `go test ./... -cover`
- [x] 3.2 `openspec validate increase-backend-coverage-dataset-marketplace --strict`
