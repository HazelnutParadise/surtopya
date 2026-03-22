# Builder Components Agent Guide

## Overview
`web/src/components/builder/` contains the survey authoring experience, including drag-and-drop editing, settings, preview, and publish flows.

## Where to Look
| Area | Path | Why |
| --- | --- | --- |
| Root orchestrator | `survey-builder.tsx` | Central state, DnD orchestration, save/publish/version flows |
| Canvas + sorting surface | `canvas.tsx`, `question-card.tsx` | Question list rendering and item interactions |
| Input sidebars | `toolbox.tsx`, `logic-editor.tsx`, `theme-editor.tsx` | Question insertion, rule editing, theme controls |
| Preview path | `preview-modal.tsx` | In-builder draft preview UI |

## Current Contracts
- `survey-builder.tsx` is currently large (~1688 lines) and remains the primary technical debt node.
- DnD behavior uses `@dnd-kit/core` + `@dnd-kit/sortable` with typed drag events and sortable context.
- Publish/share behavior must respect survey publish lock and dataset sharing lock helpers from `@/lib/survey-publish-locks`.
- Builder flow includes consent gating before entering full editing UI.
- New question types require synchronized updates across toolbox, card rendering, validation, and payload mapping.

## Anti-Patterns
- Adding more unrelated concerns directly into `survey-builder.tsx`.
- Coupling UI rendering logic with persistence/network logic when extraction is feasible.
- Introducing question type support in only one location (toolbox or renderer) and leaving partial behavior.
- Bypassing existing publish-lock helpers with local conditionals.

## Update Discipline
- Any change to builder architecture should update this file with current extraction status and remaining debt.
- Keep technical debt metrics factual (line counts, ownership boundaries, active modules).
- Prefer behavior-level notes over speculative refactor plans.