## Context
Surtopya uses points for compensating survey participants and gating paid dataset downloads. The platform also offers a Pro membership that grants a monthly base points allowance.

Operational constraint: the deployment target is single-machine Docker Compose, so we avoid cron/scheduler requirements.

## Goals / Non-Goals
- Goals:
  - Pro members receive a monthly base points grant.
  - Granting is idempotent per user per calendar month.
  - No cron/scheduler; apply lazily on the first authenticated request each month.
  - All grants/deductions are recorded as `points_transactions`.
- Non-Goals:
  - Building a full subscription billing system.
  - Retroactive grants for missed months.
  - UI/admin panel work beyond enabling backend toggles for `is_pro`.

## Decisions
- Decision: Lazy monthly grant at auth time (recommended)
  - Implement as an `UPDATE ... WHERE ...` guard on `users.pro_points_last_granted_at` with `date_trunc('month', ...)`.
  - This ensures concurrency safety without explicit `SELECT ... FOR UPDATE`.

- Decision: Configuration via env var
  - Use `PRO_MONTHLY_POINTS` (integer).
  - If unset or <= 0, monthly grants are disabled.

- Decision: Best-effort middleware
  - Monthly grant failures MUST NOT prevent the authenticated request from proceeding.
  - Errors are treated as non-fatal (request continues).

## Migration Plan
1. Add `users.pro_points_last_granted_at TIMESTAMPTZ NULL`.
2. Extend `points_transactions.type` CHECK constraint to allow `pro_monthly_grant`.
3. Deploy backend code; Pro users will be granted on their first authenticated request of a new month.

## Risks / Trade-offs
- Each authenticated request adds one extra SQL transaction attempt (guarded update + optional insert).
  - Mitigation: keep it a single row update + conditional insert; no extra reads.

