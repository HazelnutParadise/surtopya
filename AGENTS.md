# Surtopya - PROJECT KNOWLEDGE BASE

**Generated:** 2025-01-12
**Commit:** [local]
**Branch:** main

## OVERVIEW
Privacy-preserving survey platform with de-identified dataset marketplace. Monorepo with Go (Gin) backend + Next.js (App Router) frontend.

## STRUCTURE
```
surtopya/
├── api/                    # Go backend (Gin + PostgreSQL)
│   ├── cmd/                # Server entry point
│   ├── internal/            # Core business logic (handlers, repository, models, middleware, routes)
│   └── migrations/         # PostgreSQL schema initialization
├── web/                   # Next.js frontend (App Router)
│   ├── src/
│   │   ├── app/           # File-system routing (App Router)
│   │   ├── components/     # UI components (ui/, builder/, survey/)
│   │   └── lib/          # API client, Supabase integration, utilities
│   ├── messages/          # i18n JSON files (zh-TW, en, ja)
│   └── scripts/           # Custom scripts (translate.ts - LLM-powered)
└── docker-compose.yml       # Full-stack orchestration
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Backend API routes | `api/internal/routes/router.go` | All API surface + middleware chain |
| Survey builder logic | `web/src/components/builder/survey-builder.tsx` | **TECHNICAL DEBT**: 1134 lines, needs refactoring |
| i18n translations | `web/messages/` | Source of truth: zh-TW.json, run `npm run translate` for updates |
| Privacy logic | `api/internal/models/models.go` + handlers | Public surveys force dataset sharing |
| Deployment | `docker-compose.yml` | Orchestrates web, api, postgres services |

## KEY ARCHITECTURAL PATTERNS

### 1. Monorepo Structure
- **Backend** (`api/`): Go 1.24.1, Gin framework, PostgreSQL
- **Frontend** (`web/`): Next.js latest, TypeScript, Tailwind CSS v4, Radix UI
- **Database**: PostgreSQL 16, schema initialized via `migrations/` mounted to `/docker-entrypoint-initdb.d`

### 2. Hexagonal-lite (Go)
- `handlers`: HTTP layer (transport)
- `repository`: Data access (persistence)
- `models`: Domain entities
- `middleware`: Auth (Logto JWT), CORS

### 3. App Router + Server Components (Next.js)
- File-system routing in `src/app/`
- `(main)/` group for dashboard pages
- `[locale]/` dynamic routes for i18n
- Runtime env var injection: Server Components read `process.env` at request time

### 4. Privacy-Compensation Logic
- **Public surveys**: Automatically opt-in to dataset sharing (platform requirement)
- **Non-public surveys**: Default private, manual opt-in for sharing
- **Builder access**: Requires Consent Modal confirmation

## CONVENTIONS

### API Contracts
- **JSON keys**: ALL keys MUST be `snake_case` (e.g., `user_id`, `created_at`)
- **Error envelope**: `{ code, message, details, correlationId }`
- **REST**: Plural nouns, `/api/v1/` prefix

### TypeScript/JavaScript
- **No semicolons**: ASI-based, Prettier `{ "semi": false }`
- **Leading semicolons**: For lines starting with `(`, `[`, `` ` ``, `/`, `+`, `-`
- **Style**: Tailwind CSS v4, Radix UI primitives

### Go
- **Internal packages**: `internal/` directory for private logic
- **Constructor injection**: Dependency injection via constructors, no global singletons
- **Context**: `context.Context` as first parameter for I/O functions

## UNIQUE FEATURES

### 1. LLM-Powered i18n
- **Script**: `web/scripts/translate.ts` uses Ollama (llama3) to auto-translate
- **Source**: `web/messages/zh-TW.json` (truth)
- **Cache**: MD5 content hashing in `.translation-cache.json`
- **Usage**: `npm run translate` after updating source

### 2. Dynamic Environment Variables
- **Problem**: Next.js `PUBLIC_` vars baked at build time breaks Docker portability
- **Solution**: Server Components read `process.env` at request time, pass to Client Components
- **Result**: API endpoint changes in docker-compose.yml without rebuild

## ANTI-PATTERNS (THIS PROJECT)

### Forbidden Practices
- **Large files**: `survey-builder.tsx` at 1134 lines is documented technical debt
- **Mock data**: Multiple files use placeholders despite API being ready
- **Missing tests**: Zero `_test.go` files, no frontend tests (Vitest/Jest not installed)
- **Hardcoded env vars**: Use runtime injection pattern instead of baking `NEXT_PUBLIC_` vars

### Known Issues (todo.md)
- Integration testing pending
- Error handling/loading states incomplete
- Draft vs published state inconsistency in UI

## COMMANDS
```bash
# Full stack development
docker compose up --build

# Frontend dev (inside web container)
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run translate    # Auto-translate i18n files (Ollama required)

# Backend dev (inside api container)
go run cmd/server/main.go
go build -o bin/server cmd/server/main.go

# Database migrations
# Auto-executed on first postgres container start via docker-entrypoint-initdb.d
```

## ENVIRONMENT VARIABLES
| Variable | Purpose | Example |
|-----------|---------|---------|
| `PUBLIC_API_URL` | Frontend → API endpoint | `http://localhost:8080/api/v1` |
| `OLLAMA_BASE_URL` | LLM translation service | `http://host.docker.internal:11434` |
| `OLLAMA_MODEL` | Translation model | `llama3` |

## NOTES

### Gotchas
1. **i18n persistence**: `web/messages` mounted as Docker volume to persist translations
2. **No CI/CD**: No GitHub Workflows, deployment is Docker Compose manual
3. **SEO**: Non-public surveys should output `robots: { index: false, follow: true }`
4. **Lock-in**: Post-publish lockdown - dataset sharing cannot be changed after first publish

### Dependencies
- **Frontend**: Bun for package management (bun.lockb)
- **Backend**: Go modules (go.mod/go.sum)
- **Auth**: Logto (`@logto/next`) + Supabase (`@supabase/ssr`)
- **UI**: Radix UI primitives, Lucide icons

### Next Steps for New Development
1. **Backend**: Add handlers in `api/internal/handlers`, register in `routes/router.go`
2. **Frontend**: Create components in `web/src/components`, use Radix primitives
3. **i18n**: Update `web/messages/zh-TW.json`, run `npm run translate`
4. **Testing**: Add Go tests using `github.com/stretchr/testify` (already installed)
