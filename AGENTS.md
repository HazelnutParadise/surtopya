# Surtopya Agent Guide

## Overview
Surtopya is a monorepo for a survey platform focused on discoverability, long-tail response growth, and optional de-identified dataset contribution.
Facts in this file were verified against the repository on 2026-03-22.

- Backend: Go 1.25 + Gin + PostgreSQL (`api/`)
- Frontend: Next.js App Router + TypeScript + Bun (`web/`)
- CI exists in `.github/workflows/ci.yml` (API tests, web lint/tests/build/e2e)

## Where to Look
| Area | Path | Why |
| --- | --- | --- |
| Public API routing | `api/internal/routes/router.go` | Source of truth for `/v1` endpoints |
| Internal signed BFF surface | `api/internal/routes/router.go` + `web/src/app/api/app/**` | `/api/app` contract and proxy handlers |
| Backend domain logic | `api/internal/handlers`, `api/internal/repository`, `api/internal/models` | Request handling and persistence |
| Frontend routing/layout | `web/src/app` | App Router pages/layouts/route handlers |
| Shared web integrations | `web/src/lib` | API base resolution, internal signing, i18n helpers |
| Builder technical debt hotspot | `web/src/components/builder/survey-builder.tsx` | Monolithic component (~1688 lines) |
| i18n message source | `web/messages/zh-TW.json` | Canonical locale file; sync `en.json` and `ja.json` manually |

## Current Contracts
- API surfaces are split:
  - Public external API: `/v1/*`
  - Internal signed app API: `/api/app/*` (HMAC signature + timestamp)
- API JSON keys must remain `snake_case`.
- Standard API error envelope remains `{ code, message, details, correlationId }`.
- Frontend locale behavior is cookie/header/path driven (`web/src/lib/locale.ts`, `web/src/components/locale-sync.tsx`), not tied to a `[locale]` folder.
- Environment resolution is runtime-driven:
  - Browser API base prefers `NEXT_PUBLIC_API_URL`
  - Server API base prefers `INTERNAL_API_URL` then `PUBLIC_API_URL`
- Coding style is repository-driven, not a blanket "no semicolons" rule. Match surrounding files and existing lint/test tooling.

## Anti-Patterns
- Reintroducing stale project facts (old Go version, "no CI", outdated line counts/routes).
- Adding new mock-only data paths when real APIs exist.
- Hardcoding environment assumptions that bypass runtime resolution order.
- Expanding already large files (especially `survey-builder.tsx`) without extracting focused modules.

## Update Discipline
- If routes, package layout, env resolution, or CI pipeline changes, update the nearest `AGENTS.md` in the same change.
- Keep this root file cross-layer and stable; put subsystem specifics in nested `AGENTS.md` files.
- Keep text ASCII-safe and concise so downstream agents can parse it reliably.
