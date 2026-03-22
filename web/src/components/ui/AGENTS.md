# UI Components Agent Guide

## Overview
`web/src/components/ui/` provides shared UI primitives built on Radix UI and Tailwind utility classes.

## Where to Look
| Area | Path | Why |
| --- | --- | --- |
| Variant-driven actions | `button.tsx`, `badge.tsx` | CVA-based variants and shared semantics |
| Form primitives | `input.tsx`, `textarea.tsx`, `checkbox.tsx`, `radio-group.tsx`, `select.tsx`, `switch.tsx` | Consistent field building blocks |
| Overlay/menu primitives | `dialog.tsx`, `dropdown-menu.tsx`, `tooltip.tsx` | Accessible layered interactions |
| Layout primitives | `card.tsx`, `tabs.tsx`, `separator.tsx`, `progress.tsx`, `avatar.tsx`, `label.tsx` | Reusable structure components |

## Current Contracts
- Use named exports for primitives; avoid default exports for shared UI building blocks.
- Use `cn()` from `@/lib/utils` for class merging.
- Keep `data-slot` attributes consistent for styling/debug hooks.
- Component typing should use `React.ComponentProps<...>` (or Radix primitive props) for composability.
- `forwardRef` is allowed where needed by Radix primitives and existing component behavior; do not force a single ref pattern across all components.

## Anti-Patterns
- Inline hardcoded color values instead of design tokens/classes.
- Ad-hoc class string concatenation when `cn()` is available.
- Breaking Radix composition contracts (for example, missing required portal/overlay structure).
- Diverging naming conventions from existing `kebab-case` files and `PascalCase` component names.

## Update Discipline
- Update this file when primitive inventory or composition rules change.
- Keep guidance aligned with the currently implemented ref/composition patterns.
- Record only enforceable conventions that are visible in the codebase.