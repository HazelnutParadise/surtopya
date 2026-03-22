# Surtopya API Internal Agent Guide

## Overview
`api/internal/` contains core backend implementation: routing, middleware, handlers, repository, and domain modules.

## Where to Look
| Area | Path | Why |
| --- | --- | --- |
| Full endpoint map | `routes/router.go` | Canonical `/v1` and `/api/app` wiring |
| Auth and guards | `middleware/auth.go`, `middleware/admin.go`, `middleware/agent_admin.go`, `middleware/internal_app.go`, `middleware/db_ready.go` | Access control and runtime safety |
| HTTP mapping | `handlers/` | Request binding/validation/response translation |
| SQL persistence | `repository/` | Query logic and transactional writes |
| Shared schema models | `models/models.go` | API/domain structs and tags |
| Domain packages | `agentadmin/`, `deid/`, `platformlog/`, `policy/`, `surveyanalytics/`, `timeutil/` | Reusable domain-level behavior |
| DB wiring | `database/` | Connection and migration bootstrap helpers |

## Current Contracts
- Repository boundary is strict: handlers call repositories/services, not `sql.DB` directly.
- Transactional integrity for multi-entity writes belongs in repository code.
- Request auth context flows through Gin context; middleware sets identity and role data.
- DB readiness gate is enforced before v1/internal app business routes.
- Internal app routes require valid timestamp + HMAC signature checks.
- Keep JSON/API field naming in `snake_case` for external contracts.

## Anti-Patterns
- Adding business logic to `routes/`.
- Pushing SQL into handlers or middleware.
- Skipping permission middleware and relying on best-effort checks in handlers.
- Introducing hidden global state for request-scoped values.

## Update Discipline
- Update this file when internal package map, guard model, or route contracts change.
- Ensure references point to existing files/directories only.
- Keep invariants short and enforceable; avoid architecture prose that drifts from code.