# Surtopya - WEB LIB KNOWLEDGE BASE

**Location:** `web/src/lib/`
**Focus:** Cross-cutting utilities, API client, and platform integration

## OVERVIEW
Shared utilities and platform integration layer providing styling helpers, i18n management, API communication, and authentication bridges for the Surtopya frontend.

## STRUCTURE
- `utils.ts` — Styling utilities (`cn()` merge, contrast color calculation)
- `locale.ts` — Path-based locale management and URL helpers
- `i18n-server.ts` — Server-side translation bridge for Next.js
- `api.ts` — Centralized backend API client with token management
- `logto.ts` — Logto OIDC configuration
- `supabase/` — Server and client-side Supabase factory functions
- `data.ts`, `datasets-data.ts` — Mock data providers (legacy)

## WHERE TO LOOK
| Concern | File | Purpose |
|----------|------|---------|
| Styling | `utils.ts` | `cn()` for Tailwind class merging, `getContrastColor()` for accessibility |
| i18n Client | `locale.ts` | `getLocaleFromPath()`, `withLocale()` for route-aware locale handling |
| i18n Server | `i18n-server.ts` | `getServerTranslator()` for Server Component translations |
| API Integration | `api.ts` | Singleton API client with error handling and token management |
| Auth | `logto.ts` + `supabase/` | Logto config + Supabase session management |

## CONVENTIONS
- **No Semicolons**: Follow frontend's ASI-based style (no trailing semicolons)
- **Functional Utilities**: Pure functions in `utils.ts` for maximum reusability
- **Server-First i18n**: Server Components use `i18n-server.ts`, Client Components use `next-intl`
- **Mock Data Transition**: `data.ts` files exist but API is ready - prefer `api.ts`

## ANTI-PATTERNS
- **Hardcoded Strings**: User-facing text must go through i18n system, not direct strings
- **Direct Supabase Calls**: Use factory functions in `supabase/` instead of direct client imports
- **Mock Data Usage**: API is functional - avoid `lib/data.ts` for new features

## UNIQUE PATTERNS
- **Runtime Env Injection**: `api.ts` reads `process.env.PUBLIC_API_URL` at request time for Docker portability
- **Locale Persistence**: Translation files at `../messages/` mounted as Docker volume for persistence
- **Accessibility First**: `getContrastColor()` ensures text readability across dynamic themes