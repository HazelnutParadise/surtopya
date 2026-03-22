# Surtopya Web Agent Guide

## Overview
`web/` is the Next.js App Router frontend and BFF handler layer for Surtopya.

- Package manager/runtime: Bun (`bun@1.3.5`)
- UI stack: React + TypeScript + Tailwind CSS + Radix UI
- Includes App Router pages and `api/app` route handlers that proxy to backend

## Where to Look
| Area | Path | Why |
| --- | --- | --- |
| App routes/layouts | `src/app` | Page structure and server/client composition |
| BFF route handlers | `src/app/api/app/**` | Frontend-owned API gateway surface |
| Shared web integrations | `src/lib` | API base resolution, internal signatures, i18n helpers |
| UI components | `src/components/ui` | Reusable primitives |
| Builder feature | `src/components/builder` | Survey authoring logic and technical debt hotspot |
| Locale messages | `messages/` | Translation files (`zh-TW` source of truth) |

## Current Contracts
- Routing model is App Router route groups and folders; locale behavior is not implemented via a `src/app/[locale]` segment.
- Server-side internal API calls use signed `/api/app` flow via `src/lib/internal-app-fetch.ts`.
- API base resolution:
  - Server: `INTERNAL_API_URL` -> `PUBLIC_API_URL` -> fallback
  - Browser/client helpers may use `NEXT_PUBLIC_API_URL` before other fallbacks
- i18n source is `messages/zh-TW.json`; keep `en.json` and `ja.json` in sync manually.
- Follow local file style conventions instead of global assumptions (some files use semicolons, some do not).

## Anti-Patterns
- Reintroducing stale assumptions about locale folder structure.
- Hardcoding a single API origin in code paths that already support runtime env resolution.
- Shipping new user-facing strings without message file updates.
- Growing `survey-builder.tsx` further without extraction.

## Update Discipline
- Update this file when app route topology, env resolution, or message workflow changes.
- Keep this layer focused on web-wide contracts; domain-specific details belong in nested `AGENTS.md` files.
- Keep text concise and path-accurate for agent handoff.