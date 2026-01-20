# INTERNAL BACKEND KNOWLEDGE BASE

**Location:** `api/internal/`  
**Focus:** Core business logic, data persistence, and API transport.

## OVERVIEW
Hexagonal-lite architecture implementing core Surtopya domain logic (Surveys, Datasets, Points) using Gin and PostgreSQL.

## STRUCTURE
- `database/`: PostgreSQL connection pool management (`sql.DB`).
- `handlers/`: HTTP transport layer; handles request binding, validation, and response mapping.
- `middleware/`: Auth logic (Logto JWT extraction) and CORS.
- `models/`: Central domain entities (User, Survey, Question, Response, Dataset, etc.) with DB/JSON tags.
- `repository/`: Data access layer; handles SQL queries, JSON marshaling, and DB transactions.
- `routes/`: Centralized API routing and endpoint grouping.

## WHERE TO LOOK
| Logic Type | Primary Directory | Notes |
|------------|-------------------|-------|
| API Endpoints | `routes/router.go` | Source of truth for all `/api/v1` routes |
| Business Validation | `handlers/` | Enforces privacy-sharing rules (e.g., public survey requirements) |
| SQL Queries | `repository/` | Direct SQL implementation; manages question sorting and JSON fields |
| Auth Context | `middleware/auth.go` | Populates `userID` in `gin.Context` from Logto JWT |
| Domain Schema | `models/models.go` | Defines UUID-based entities and valid enum values |

## CONVENTIONS
- **Constructor Injection**: Handlers are initialized with Repositories (e.g., `NewSurveyHandler()`). Avoid global singletons for business logic.
- **No ORM**: Uses standard `database/sql` for transparency and performance. Complex structures (Themes, Logic Rules) are stored as JSONB.
- **Context Handling**: Always retrieve `userID` from `gin.Context` for authenticated operations.
- **Transaction Safety**: Multi-step operations (like saving a survey with questions) MUST use `tx.Begin()` within the repository layer.
- **Error Mapping**: Handlers are responsible for mapping internal errors to appropriate HTTP status codes.

## ANTI-PATTERNS
- **Logic Leaks**: Avoid placing business logic or SQL in `routes/` or `models/`.
- **Direct DB Access**: Handlers must never call `sql.DB` directly; always use a Repository.
- **Implicit States**: Avoid using global variables for request-scoped data; use `gin.Context`.
