<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:module-conventions -->
# Module conventions

Every module follows this structure unless it's a trivial single-file module:

```
ModuleName/
├── index.tsx                 # Barrel — only re-exports, no implementation
├── ModuleName.tsx            # Main component (or separate file if barrel pattern used)
├── types.ts                  # Props and any types specific to this module
├── constants.ts              # Constants specific to this module
└── helpers.ts                # Pure helper functions
```

Sub-components inside a module's `components/` folder are **single `.tsx` files** organized into type-based subdirectories — not full module directories:

```
ModuleName/
├── index.tsx               # Barrel
├── ModuleName.tsx          # Main component
├── types.ts                # All sub-component props go here (no local types.ts)
├── helpers.ts
├── constants.ts
└── components/
    ├── header/             # ReelHeader.tsx, PageHeader.tsx (flat files)
    ├── sections/           # ScoreSection.tsx, PersonalStyleSection.tsx
    ├── grids/              # ScorecardGrid.tsx, QualityGrid.tsx
    ├── cards/              # ViralFormulaCard.tsx, StatsCard.tsx
    ├── lists/              # TagList.tsx, SuggestionList.tsx
    └── modals/             # NewAnalysisModal.tsx, AnalysisModal.tsx
```

Sub-components are single `.tsx` files — no `index.tsx`, no local `types.ts`, no module wrapper. Their props live in the parent module's `types.ts`.

Name components after their type suffix (`*Header`, `*Section`, `*Grid`, `*Card`, `*List`) — the suffix must match the subdirectory it lives in (e.g. `AnalysisResultsSection` in `sections/`, `ScorecardGrid` in `grids/`).

- **One component per file** — each `.tsx` file exports exactly one component.
- **Props in the nearest parent `types.ts`** — every component's props are defined in a module `types.ts`, never inline.
- **Top-level modules** (at `components/` root or in `app/`) are full module directories with `index.tsx`, `types.ts`, `helpers.ts`, `constants.ts` as needed.
<!-- END:module-conventions -->

<!-- BEGIN:data-transformation -->
# Data transformation rules

Transform data as early as possible in the data pipeline. Do NOT transform raw data inside UI components.

- **API layer** (`lib/api/*/api.ts`): Return data as-is from the server. No transformation.
- **Query hooks** (`lib/api/*/hooks.ts`): Transform data here using `select` on `useQuery`. This is the preferred place for all data transformation (parsing, mapping, deriving computed fields).
- **UI components** (`app/**/*.tsx`): Consume already-transformed data. Only do presentation formatting (colors, date formatting, number display) here — never parse or reshape data.

Exception: Only transform in the UI layer if the underlying query is too expensive to re-run on every render (e.g., large datasets where `select` would cause unnecessary computation). In that case, memoize the transformation with `useMemo`.
<!-- END:data-transformation -->
