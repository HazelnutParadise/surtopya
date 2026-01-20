# UI Components Knowledge Base

## OVERVIEW
Atomic UI primitive library built on Radix UI and Tailwind CSS v4, serving as the design system's foundation.

## WHERE TO LOOK
| Component | Responsibility | Key Pattern |
|-----------|----------------|-------------|
| `button.tsx` | Primary actions | `cva` variant management + `asChild` |
| `dialog.tsx` | Modals/Overlays | Radix composition (Portal/Overlay/Content) |
| `input.tsx` | Form controls | Raw element wrapping with shared styles |
| `dropdown-menu.tsx` | Menus/Actions | Multi-part Radix export pattern |

## CONVENTIONS
- **Naming**: File names MUST be `kebab-case.tsx` (e.g., `dropdown-menu.tsx`). Exported components MUST be `PascalCase` (e.g., `DropdownMenu`).
- **Styling (v4)**: Use Tailwind CSS v4 design tokens (e.g., `bg-primary/90`, `ring-ring/50`).
- **Data Slots**: Include `data-slot` attributes on all components (e.g., `data-slot="button"`) for consistency and global targeting.
- **Prop Injection**: Use `React.ComponentProps<"element">` or `React.ComponentProps<typeof Primitive.X>` for type safety.
- **Composition**: Prefer exporting individual sub-components (Trigger, Content, Item) over monolithic props.
- **Class Merging**: ALWAYS use the `cn()` utility from `@/lib/utils` for `className` merging.
- **Ref Handling**: Relies on React 19's native `ref` prop support; `forwardRef` is generally omitted in favor of spreading `props` (which includes `ref` in `ComponentProps`).

## ANTI-PATTERNS
- **Hardcoded Styles**: DO NOT use hex/rgb codes; use CSS variables defined in the theme.
- **Manual String Concatenation**: DO NOT use template literals for classes; use `cn()`.
- **Breaking Radix Structure**: DO NOT omit `Portal` or `Overlay` in overlays (Dialog, Popover) as it breaks accessibility/stacking.
- **Inconsistent Exports**: DO NOT export defaults; use named exports for all UI primitives.
