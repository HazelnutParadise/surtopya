# Component: Survey Builder

## OVERVIEW
Drag-and-drop interface for survey construction, incorporating question management, logic branching, and visual theme customization.

## WHERE TO LOOK
| Component | Responsibility |
|-----------|----------------|
| `survey-builder.tsx` | **Monolithic Root**: Manages state, dnd-kit context, and the Consent Modal. |
| `canvas.tsx` | Main drop zone and sortable list container for survey questions. |
| `question-card.tsx` | Individual question renderer with edit/delete/duplicate controls. |
| `toolbox.tsx` | Sidebar menu containing draggable question types (Text, MCQ, Rating, etc.). |
| `logic-editor.tsx` | Interface for defining skip logic and conditional branching rules. |
| `theme-editor.tsx` | Controls for visual styling (colors, typography, background). |
| `preview-modal.tsx` | Interactive simulation of the survey draft for validation. |

## CONVENTIONS
- **Drag-and-Drop**: Implemented via `@dnd-kit/core` and `@dnd-kit/sortable`. Uses `PointerSensor` and `verticalListSortingStrategy`.
- **Consent Pattern**: Access to the builder is gated by a "Data Usage Consent" modal (currently inline in `survey-builder.tsx`).
- **State Management**: Uses a single `survey` object state. Updates are performed via deep cloning or immutability helpers.
- **Question Types**: New question types must be registered in `toolbox.tsx` and handled in `question-card.tsx`.

## ANTI-PATTERNS
- **Giant File**: `survey-builder.tsx` (1134 lines) is the primary technical debt; it combines business logic, dnd orchestration, and UI layout.
- **State Coupling**: Question editing logic is tightly coupled with the sorting logic in the root component.
- **Inlined Components**: Several sub-sections (Toolbar, Status Bar) are not yet extracted into separate files.

## REFACTORING TASKS
1. **Extract Logic Hook**: Move survey manipulation (add/remove/update question) to `use-survey-builder.ts`.
2. **Componentize Modals**: Move the Consent Modal and various settings dialogs to standalone files.
3. **Decompose Root**: Break `survey-builder.tsx` into:
   - `builder-toolbar.tsx`: Action buttons (Preview, Save, Publish).
   - `builder-sidebar.tsx`: Wraps `Toolbox`, `LogicEditor`, and `ThemeEditor`.
   - `builder-canvas-wrapper.tsx`: Manages `DndContext` and `SortableContext`.
4. **Typed Events**: Define explicit TypeScript interfaces for dnd-kit event payloads to improve type safety during drag operations.
