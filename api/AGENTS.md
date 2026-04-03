# Surtopya API Agent Guide

## Overview
`api/` hosts the Go service for public APIs (`/v1`) and the internal signed app surface (`/api/app`).

- Runtime: Go 1.25
- HTTP framework: Gin
- Data store: PostgreSQL via `database/sql`

## Where to Look
| Area | Path | Why |
| --- | --- | --- |
| Server bootstrap | `cmd/server/main.go` | Dependency wiring, config, startup |
| Router surface | `internal/routes/router.go` | Full route and middleware registration |
| Handlers | `internal/handlers` | Transport layer and HTTP mapping |
| Middleware | `internal/middleware` | Auth/admin/agent/internal-app gates and request guards |
| Repositories | `internal/repository` | SQL persistence and transaction boundaries |
| Author profile/public pages | `internal/handlers/author.go`, `internal/repository/author_repo.go` | `@slug` resolution, redirect aliases, public field filtering |
| Domain modules | `internal/agentadmin`, `internal/deid`, `internal/platformlog`, `internal/policy`, `internal/surveyanalytics` | Service-level domain behavior |

## Current Contracts
- Route surfaces:
  - `/v1/*` for public/partner access.
  - `/api/app/*` for frontend internal BFF usage (requires internal signature).
- Admin/detail additions now live on the same surfaces as list/update:
  - `/api/app/admin/users/:id`
  - `/v1/agent-admin/users/:id`
  - `/v1/agent-admin/surveys/:id/responses`
- Agent-admin logs use filtered cursor pagination on `(created_at, id)` and expose `meta.limit`, `meta.total`, `meta.next_cursor`, and `meta.has_more`.
- Middleware chain is centralized in router setup and must remain consistent (CORS, logging/correlation, DB-ready guard, auth token processing).
- Handler layer must not execute raw SQL directly; repository layer owns DB access.
- Multi-step write operations must run in repository-managed DB transactions.
- API payload keys are `snake_case`.
- Agent-admin and admin endpoints are permission-gated via middleware, not handler-local shortcuts.

## Anti-Patterns
- Bypassing router middleware by creating ad-hoc endpoints.
- Duplicating permission logic in handlers instead of middleware guards.
- Introducing package-level mutable globals for request-scoped behavior.
- Moving persistence logic from repositories into handlers.

## Update Discipline
- Update this file when route groups, middleware order, or major domain modules change.
- Keep this file API-layer specific; put deeper rules in `api/internal/AGENTS.md`.
- Keep examples aligned with actual code paths that exist in this repo.
