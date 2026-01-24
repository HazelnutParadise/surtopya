# Surtopya - APP ROUTER KNOWLEDGE BASE

**Location:** `web/src/app/`
**Focus:** Next.js App Router with i18n and route groups

## OVERVIEW
Next.js App Router implementation with file-system based routing, route groups for shared layouts, and dynamic internationalization support.

## STRUCTURE
```
app/
├── (main)/               # Route group for authenticated dashboard pages
├── survey/                # Public survey access and responses
├── create/                 # Survey creation flow
├── api/                    # Next.js Route Handlers (BFF layer)
└── [locale]/                # Dynamic i18n routes (when active)
```

## WHERE TO LOOK
| Feature | Path Pattern | Purpose |
|---------|--------------|---------|
| Dashboard | `(main)/*` | Authenticated user area with shared layout |
| Survey Taking | `survey/[id]` | Public survey access and response submission |
| Survey Creation | `create/*` | Multi-step survey building process |
| BFF APIs | `api/*` | Frontend-backend integration layer |
| Internationalization | `[locale]/*` | Dynamic locale routing for SEO |

## CONVENTIONS
- **File-System Routing**: Page structure defines routes automatically (no explicit router config)
- **Route Groups**: `(main)` groups pages under shared layout/auth logic
- **Dynamic Routes**: `[id]` for resources, `[locale]` for i18n prefix
- **Layout Inheritance**: Child layouts inherit from parent `layout.tsx`

## ANTI-PATTERNS
- **Route Pollution**: Don't mix static pages with dynamic routes in same directory
- **Missing Locale**: Ensure all pages support i18n routing pattern
- **Layout Conflicts**: Avoid nested route groups that create layout inheritance issues

## UNIQUE PATTERNS
- **BFF Coexistence**: Next.js API routes coexist with Go backend for frontend-specific logic
- **SEO-First i18n**: Dynamic locale routes support search engine optimization
- **Server Components**: Root layout uses Server Components for i18n message merging
- **Draft Management**: Create flow uses multi-step patterns with draft persistence