# Web Lib Agent Guide

## Overview
`web/src/lib/` contains shared runtime helpers for API access, auth tokens, internal app signing, i18n, and UI utilities.

## Where to Look
| Area | Path | Why |
| --- | --- | --- |
| Browser-side API client | `api.ts` | Client request helpers and typed payloads |
| Server-side API base/auth token | `api-server.ts` | Server API base resolution and auth token generation |
| Internal app request signing | `internal-app-fetch.ts` | HMAC signature/timestamp for `/api/app` calls |
| Locale and message helpers | `locale.ts`, `i18n-server.ts` | Locale matching and server-side translation loading |
| User setting sync contracts | `user-settings.ts`, `date-time.ts` | Locale/timezone persistence and normalization |
| Shared UI helpers | `utils.ts`, `ui-error.ts`, `ui-telemetry.ts` | Class merge and UI-facing utility logic |

## Current Contracts
- API base URL resolution must remain environment-driven (do not collapse to one hardcoded origin).
- Internal app requests must preserve signature and timestamp behavior (`X-Surtopya-App-*` headers).
- Locale support is currently `zh-TW`, `en`, `ja` and should stay centralized in `locale.ts`.
- Shared library code should be reusable and side-effect-light; keep feature-specific UI logic outside this folder.
- Prefer real API contracts over ad-hoc mock data paths.

## Anti-Patterns
- Bypassing `internal-app-fetch.ts` for server-side app-internal operations.
- Duplicating locale resolution logic in pages/components instead of reusing `locale.ts`.
- Adding new API wrappers with inconsistent error handling semantics.
- Leaving stale utility files that are no longer referenced.

## Update Discipline
- Update this file when key library entrypoints or env/signature/locale contracts change.
- Keep the inventory focused on actively used modules; remove references to deleted files.
- Ensure listed contracts map directly to current code paths.