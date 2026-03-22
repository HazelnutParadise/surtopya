# Surtopya

Publish surveys that keep growing.

Surtopya is a survey platform where each survey can stay discoverable, keep collecting responses over time, and optionally contribute de-identified data to a community marketplace.

## Product Positioning

- Discoverability first: surveys are designed to be searchable and shareable
- Long-tail response growth: surveys continue to attract new responses after launch
- Data contribution model: eligible responses can be de-identified and shared as datasets

Current homepage metadata direction:

- Title: `Surtopya | Publish Surveys That Keep Growing`
- Description: `Turn every survey into a searchable page, collect responses over time, and contribute de-identified data to a research community marketplace.`

## Monorepo Structure

```text
surtopya/
├── api/                    # Go backend (Gin + PostgreSQL)
│   ├── cmd/                # Server entry point
│   ├── internal/           # handlers, repository, models, middleware, routes
│   └── migrations/         # PostgreSQL init scripts
├── web/                    # Next.js frontend (App Router + TypeScript)
│   ├── src/
│   │   ├── app/            # routes
│   │   ├── components/     # UI and feature components
│   │   └── lib/            # API client, i18n/runtime utils
│   └── messages/           # i18n message files (zh-TW, en, ja)
└── docker-compose.yml      # full-stack orchestration
```

## Tech Stack

- Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS v4, Radix UI
- Backend: Go, Gin
- Database: PostgreSQL 16
- Auth: Logto
- Package manager (web): Bun

## Quick Start

### Prerequisites

- Docker + Docker Compose
- Bun (for local web development)
- Go (for local API development)

### Run full stack with Docker

Development:

```bash
docker compose --env-file .env.development up --build
```

Production-like:

```bash
docker compose --env-file .env.production up -d --build
```

Default local URLs:

- Web: `http://localhost:3000`
- Public API: `http://localhost:8000/v1`

## Local Development (without full Docker workflow)

### Web

```bash
cd web
bun install
bun run dev
```

Other useful commands:

```bash
bun run build
bun run test
bun run lint
```

### API

```bash
cd api
go run cmd/server/main.go
```

Build binary:

```bash
go build -o bin/server ./cmd/server
```

## Environment Variables

Most setups only need this for frontend API access:

| Variable | Purpose | Example |
| --- | --- | --- |
| `PUBLIC_API_URL` | Frontend base URL to public API | `http://localhost:8000/v1` |

Notes:

- `PUBLIC_` values can be supplied from Compose env files
- Frontend uses runtime server-side env access pattern to avoid hard-baked endpoints

## i18n Workflow

- Source of truth: `web/messages/zh-TW.json`
- Keep `web/messages/en.json` and `web/messages/ja.json` manually in sync
- Locale routes are served via App Router locale segment pattern

## Privacy and Data Sharing Rules

- Public surveys: dataset sharing is automatically enabled (platform rule)
- Non-public surveys: sharing can be controlled manually (subject to plan/capability rules)
- Dataset contributions are de-identified before marketplace exposure

## API Conventions

- Base path: `/v1/...`
- JSON keys: `snake_case`
- Error envelope: `{ code, message, details, correlationId }`

## Testing Status

Current test coverage is still limited.

- Web: Vitest-based component and page tests
- API: basic and targeted handler/repository tests

Recommended before release:

- Add integration tests for key survey and dataset flows
- Strengthen error/loading state tests on frontend

## Contribution Notes

- Avoid introducing new mock-only flows where real API is already available
- Prefer smaller components over adding logic to large monolithic files
- Keep formatting consistent with project defaults (TypeScript no semicolons in web code)

