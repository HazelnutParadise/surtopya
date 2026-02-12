## Decisions
- Use `data-testid` for Playwright selectors to avoid brittle text-based matching.
- Prefer mocking Next.js BFF routes (`/api/*`) in tests to avoid needing real auth/API services.

