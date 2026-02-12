# OpenSpec Project Conventions (Surtopya)

## Stack
- Backend: Go (Gin) + PostgreSQL
- Frontend: Next.js (App Router) + TypeScript + Tailwind + Radix UI
- Auth: Logto (JWT)
- Deploy (current): Docker Compose

## Contracts
- API JSON keys: prefer `snake_case` (existing code still has some `camelCase`; changes should be compatible)
- Error envelope target: `{ code, message, details, correlationId }` (keep legacy `error` during migration)
- REST: `/api/v1/*`

## Monorepo Layout
- `api/`: Go backend (handlers/repository/models/middleware)
- `web/`: Next.js frontend + BFF routes in `web/src/app/api/*`
- `openspec/`: specs and change proposals

## Quality Gates (Target)
- `bun run lint` must be 0 error
- `bunx vitest run` must pass
- `go test ./...` must pass
- E2E: Playwright smoke tests must pass (at least routing + key pages with API mocked)

## Notes
- Keep changes incremental: prefer adding new code paths and maintaining backward compatibility.
- Prefer dependency injection in Go handlers where feasible (avoid hard-coding globals in new code).
