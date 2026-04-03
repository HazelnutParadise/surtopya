# App Router Agent Guide

## Overview
`web/src/app/` contains Next.js App Router pages, layouts, and route handlers for both UI pages and BFF APIs.

## Where to Look
| Area | Path | Why |
| --- | --- | --- |
| Root layout and bootstrap flow | `layout.tsx` | Locale, auth bootstrap, global providers |
| Main site pages | `(main)/**` | Marketing, dashboard, datasets, docs, pricing |
| Survey builder and response pages | `create/**`, `survey/**` | Build/take survey flows |
| Author pages | `(main)/author/**` | Public author profile + published survey listing via `@slug` URLs |
| App-internal API handlers | `api/app/**` | BFF endpoints consumed by web app |
| Docs/auth handlers | `api/docs/**`, `api/logto/**` | OpenAPI and auth action routes |

## Current Contracts
- Use route handlers in `api/app/**` as the frontend BFF boundary for app operations.
- Admin user detail now proxies through `api/app/admin/users/[id]/route.ts` for both `GET` and `PATCH`.
- Admin policy bootstrap loads subscription plans separately from `/api/app/admin/policies`; do not expect `tiers` in the policies payload.
- Authenticated survey taking flows use app-internal draft handlers under `api/app/surveys/[id]/drafts/**`; keep resume (`start`) and destructive restart (`restart`) semantics aligned with backend behavior.
- `@slug` public author URLs are rewritten in middleware to internal `/author/[slug]` routes.
- Keep route handler semantics aligned with backend router contracts (`/api/app/*` and `/v1/*`).
- Locale behavior is controlled by cookies/headers/path utilities (`LocaleSync`, `locale.ts`), not a dedicated `[locale]` route folder.
- Root layout owns global concerns (messages, timezone, bootstrap auth redirect, effects/providers).

## Anti-Patterns
- Duplicating backend business logic inside route handlers.
- Creating parallel API paths outside `api/app/**` for app features without clear justification.
- Introducing route structures that conflict with current `(main)` grouping and shared layouts.
- Adding new app pages with untranslated user-facing copy.

## Update Discipline
- Update this file when route topology changes (new groups, moved handlers, removed sections).
- Keep references to concrete folder patterns that currently exist.
- If bootstrap/auth/locale ownership moves out of `layout.tsx`, update contracts here immediately.
