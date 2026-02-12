## Decision
Use a locale-aware query parameter on the thank-you route to carry the awarded points:

- Navigate to `/<locale>/survey/thank-you?points=<n>` after a successful submit.
- The thank-you page reads `points` from the URL and renders it.

## Rationale
- Works with App Router navigation without requiring global state.
- Easy to test in Playwright.
- Avoids persisting sensitive state (we only pass a small integer).

