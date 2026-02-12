# Change: Update Points Economy (Pro Monthly Grant + Clarified Rules)

## Why
We need a consistent, production-ready points economy that supports dataset purchases and Pro membership, without adding cron/scheduler operational complexity.

## What Changes
- Define a dedicated `points-economy` capability that documents points rules.
- Add a **Pro monthly base points** grant applied lazily on the first authenticated request of each calendar month.
- Clarify that **publishing surveys costs 0 points**.
- Ensure all grants/deductions are recorded in `points_transactions` with explicit transaction types.

## Impact
- Affected specs:
  - `specs/points-economy/spec.md` (new capability; added via change delta)
- Affected code:
  - `api/migrations/*` (users column + points transaction type check)
  - `api/internal/repository/points_repo.go` (new grant method)
  - `api/internal/middleware/auth.go` (invoke lazy monthly grant)
  - `api/internal/handlers/admin.go` (allow super-admin to set `is_pro`)
  - `.env.example`, `docker-compose.yml` (configure `PRO_MONTHLY_POINTS`)

