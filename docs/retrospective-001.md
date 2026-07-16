# Retrospective 001: Architecture Refinement & Code Style

## Summary

Applied feedback from `feedbacks.md` to align the codebase with updated architecture conventions. The changes addressed component naming, module placement, inlining, and layout structure.

## Changes

### 1. Section naming convention

All components in `sections/` directories renamed with `Section` suffix:

| File | Renamed to |
|------|-----------|
| `app/analyses/components/sections/AnalysisFilter.tsx` | `AnalysisFilterSection.tsx` |
| `app/analyses/components/sections/AnalysisEmpty.tsx` | `AnalysisEmptySection.tsx` |
| `app/analyses/[id]/components/sections/AnalysisScorecard.tsx` | `AnalysisScorecardSection.tsx` |
| `app/analyses/[id]/components/sections/AnalysisPerItem.tsx` | `AnalysisPerItemSection.tsx` |
| `app/analyses/[id]/components/sections/AnalysisPatterns.tsx` | `AnalysisPatternsSection.tsx` |
| `app/analyses/[id]/components/sections/AnalysisSuggestions.tsx` | `AnalysisSuggestionsSection.tsx` |

### 2. Inlined "Content" wrapper components

- `AnalysesContent` inlined into `app/analyses/page.tsx`
- `DetailContent` inlined into `app/analyses/[id]/page.tsx`
- Both wrapper files deleted. Pages now directly manage their own state and rendering.

### 3. PinScreen inlined into auth page

- `PinScreen` component merged into `app/auth/pin/page.tsx`
- `components/PinScreen/` module directory deleted

### 4. Module relocation

Modules moved closer to where they belong (under `app/analyses/`):

| From | To |
|------|-----|
| `components/AnalysisProgressPanel/` | `app/analyses/components/progress/AnalysisProgressPanel/` |
| `components/UrlChipInput/` | `app/analyses/components/chips/UrlChipInput/` |
| `app/analyses/modals/` | `app/analyses/components/modals/` |

### 5. Layout restructure

- `app/analyses/layout.tsx` removed
- Sidebar now global via `components/AppShell/` — a client wrapper that conditionally renders the sidebar (skips on `/auth/*` routes)
- Root `app/layout.tsx` updated to use `AppShell`

### 6. Sub-component module directories

All 12 flat sub-component files converted to module directories with barrels:

| Path | Converted to |
|------|-------------|
| `components/cards/AnalysisCard.tsx` | `cards/AnalysisCard/` + `index.tsx` |
| `components/grids/AnalysisGrid.tsx` | `grids/AnalysisGrid/` + `index.tsx` |
| `components/grids/AnalysisGridSkeleton.tsx` | `grids/AnalysisGridSkeleton/` + `index.tsx` |
| `components/modals/NewAnalysisModal.tsx` | `modals/NewAnalysisModal/` + `index.tsx` |
| `components/sections/AnalysisFilterSection.tsx` | `sections/AnalysisFilterSection/` + `index.tsx` |
| `components/sections/AnalysisEmptySection.tsx` | `sections/AnalysisEmptySection/` + `index.tsx` |
| `[id]/components/header/AnalysisDetailHeader.tsx` | `header/AnalysisDetailHeader/` + `index.tsx` |
| `[id]/components/sections/AnalysisScorecardSection.tsx` | `sections/AnalysisScorecardSection/` + `index.tsx` |
| `[id]/components/sections/AnalysisPerItemSection.tsx` | `sections/AnalysisPerItemSection/` + `index.tsx` |
| `[id]/components/sections/AnalysisPatternsSection.tsx` | `sections/AnalysisPatternsSection/` + `index.tsx` |
| `[id]/components/sections/AnalysisSuggestionsSection.tsx` | `sections/AnalysisSuggestionsSection/` + `index.tsx` |
| `[id]/components/sections/PatternBlock.tsx` | `sections/PatternBlock/` + `index.tsx` + `types.ts` |

PatternBlock had its inline props extracted to a local `types.ts`.

### 7. `/app` route restructure

Authorized routes moved under `/app/` with their own layout; auth routes stay under `/auth/`:

- `app/analyses/` → `app/app/analyses/` (all sub-components, pages, types)
- `app/app/layout.tsx` — wraps `/app/*` routes with `Sidebar`
- `app/auth/` — no layout, no sidebar (full-screen PIN screen)
- Root `app/layout.tsx` — bare HTML/body/QueryClientProvider/Toaster only
- `components/AppShell/` deleted (no longer needed)
- Updated paths: `proxy.ts`, `Sidebar.tsx`, `app/page.tsx`, `auth/pin/page.tsx`
- Updated all `@/app/analyses` imports → `@/app/app/analyses` within moved files

### 8. AGENTS.md updated

Sub-component conventions updated to support module directories (with barrel, local types/constants/helpers) for sub-components. Barrels stop at sub-component level.

## File changes

- **Modified** (10): AGENTS.md, app/layout.tsx, app/page.tsx, proxy.ts, Sidebar.tsx, auth/pin/page.tsx, AnalysisPatternsSection.tsx, AnalysisGrid.tsx, app/analyses/page.tsx, app/analyses/[id]/page.tsx
- **Created** (16): `app/app/layout.tsx`, 12 sub-component barrels, `PatternBlock/types.ts`, `docs/retrospective-001.md`
- **Deleted** (7): AnalysesContent.tsx, DetailContent.tsx, PinScreen/ (full module), AppShell/ (full module), app/analyses/layout.tsx, app/analyses/modals/ (directory)
- **Moved** (18+): `app/analyses/` → `app/app/analyses/` (whole tree), 12 flat files → module dirs, 3 module relocations (AnalysisProgressPanel, UrlChipInput, NewAnalysisModal)

## Verifications

- Lint (`eslint`): clean
- TypeScript (`tsc --noEmit`): clean
