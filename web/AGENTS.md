# Surtopya - WEB FRONTEND KNOWLEDGE BASE

**Location:** `web/`
**Service:** Next.js (App Router)

## OVERVIEW
High-performance frontend providing a premium survey builder and de-identified dataset marketplace.

## STRUCTURE
```
web/
├── src/
│   ├── app/           # App Router ( (main)/ group, [locale]/ routing )
│   ├── components/    # UI components (ui/, builder/, survey/)
│   ├── lib/           # Logic (api.ts, supabase/, utils.ts)
│   └── types/         # TypeScript definitions
├── messages/          # i18n JSON files (Source: zh-TW.json)
└── scripts/           # translate.ts (LLM-powered translation)
```

## WHERE TO LOOK
| Feature | Path | Notes |
|---------|------|-------|
| Routing | `src/app/` | Uses `(main)` group for shared layouts |
| Survey Builder | `src/components/builder/` | Main logic in `survey-builder.tsx` |
| Survey Rendering | `src/components/survey/` | Dynamic renderer for responses |
| API Integration | `src/lib/api.ts` | Backend communication client |
| Translations | `messages/` | Auto-sync via `npm run translate` |

## CONVENTIONS

### 1. Code Style
- **No Semicolons**: Rely on ASI (Automatic Semicolon Insertion).
- **Leading Semicolons**: Mandatory only for lines starting with `(`, `[`, `` ` ``, `/`, `+`, `-`.
- **Naming**: `kebab-case` for files, `PascalCase` for components/types.

### 2. Runtime Environment Variables
- **Problem**: `NEXT_PUBLIC_` vars are baked at build time, breaking Docker portability.
- **Solution**: Read `process.env` in **Server Components** and pass to Client Components via props.
- **Example**: See `src/app/(main)/datasets/[id]/page.tsx`.

### 3. Internationalization (i18n)
- **Source of Truth**: `messages/zh-TW.json`.
- **Automation**: Run `npm run translate` to update `en.json` and `ja.json` using Ollama.
- **Routing**: Dynamic `[locale]` prefixing for SEO and locale persistence.

## ANTI-PATTERNS
- **NEXT_PUBLIC_ Leakage**: Avoid using `NEXT_PUBLIC_API_URL` directly in client components if it must change per environment. Use the injection pattern.
- **Monolithic Builder**: `survey-builder.tsx` is currently oversized (>1100 lines); new features should be extracted to sub-components.
- **Hardcoded Strings**: All user-facing text must reside in `messages/` for i18n support.
