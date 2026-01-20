# Surtopya API - Backend Knowledge Base

## OVERVIEW
Go-based REST API service using Gin framework and PostgreSQL for the Surtopya privacy survey platform.

## STRUCTURE
```
api/
├── cmd/server/          # Application entry point (main.go)
├── internal/            # Private core logic
│   ├── handlers/        # HTTP transport layer (Request/Response)
│   ├── middleware/      # Gin middleware (Auth, CORS, Logging)
│   ├── models/          # Domain entities and Database schemas
│   ├── repository/      # Data access layer (PostgreSQL/SQL queries)
│   └── routes/          # API route registration
└── migrations/          # PostgreSQL schema initialization scripts
```

## WHERE TO LOOK
| Component | Path | Responsibility |
|-----------|------|----------------|
| Entry Point | `cmd/server/main.go` | Dependency wiring and server bootstrap |
| API Routes | `internal/routes/router.go` | Central endpoint mapping |
| Auth Logic | `internal/middleware/auth.go` | Logto JWT verification |
| DB Logic | `internal/repository/` | SQL implementation and persistence |
| Models | `internal/models/models.go` | Struct definitions for GORM/JSON |

## CONVENTIONS
- **Internal Only**: All core logic MUST be under `internal/` to enforce Go's visibility rules.
- **Constructor Injection**: Use `NewRepository(db)` and `NewHandler(repo)` patterns; avoid global singletons.
- **Context Propagation**: Always pass `context.Context` as the first argument to I/O and repository functions.
- **Error Wrapping**: Use `fmt.Errorf("...: %w", err)` to preserve error chains.
- **SQL Naming**: Database columns and JSON tags MUST use `snake_case`.

## ANTI-PATTERNS
- **Fat Handlers**: Do not put business logic in handlers; delegate to domain or repository layers.
- **Global DB Variables**: Never use a global `db` variable; inject the database connection via constructors.
- **Bypassing Repository**: Handlers should never execute raw SQL or call the database driver directly.
- **Magic Strings**: API paths and error messages should be defined as constants or centralized.
