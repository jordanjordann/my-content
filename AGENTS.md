<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:file-editing-rules -->
# Never write files with shell redirection

Create and modify repository files with the dedicated file write/edit tools only.

- **Never** use heredocs (`cat > file << 'EOF'`), `echo >`, `printf >`, `>>`, `tee`, or in-place editors (`sed -i`, `perl -i`) on files tracked in this repo.
- Shell redirection clobbers a file blind. The edit tools fail loudly when a file isn't in the expected state, which catches conflicts early — especially with multiple agents working in parallel worktrees.
- Each shell write also triggers its own permission prompt, which is noisy for the user.

Exception: redirection is fine for throwaway scratch files outside the repo (e.g. `/tmp`), and for genuine shell pipelines whose output isn't a source file.
<!-- END:file-editing-rules -->

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

Sub-components inside a module's `components/` folder follow this structure:

```
ModuleName/
├── index.tsx               # Barrel — re-exports all sub-components
├── ModuleName.tsx          # Main component
├── types.ts                # Props for main component and sub-components
├── helpers.ts
├── constants.ts
└── components/
    ├── header/
    │   └── SomethingHeader/        # Module directory for sub-component
    │       ├── index.tsx           # Barrel — re-exports SomethingHeader and its types
    │       ├── SomethingHeader.tsx  # Implementation
    │       ├── types.ts            # Types specific to SomethingHeader
    │       ├── constants.ts        # Constants specific to SomethingHeader
    │       └── helpers.ts          # Helpers specific to SomethingHeader
    ├── sections/           # Flat files or module directories
    ├── grids/              # Flat files or module directories
    ├── cards/              # Flat files or module directories
    ├── lists/              # Flat files or module directories
    └── modals/             # Flat files or module directories
```

Sub-components can be either:
- **Flat files** (simple sub-components): single `.tsx` file, no barrel, no local types/constants/helpers. Props live in the parent module's `types.ts`.
- **Module directories** (complex sub-components): full module with `index.tsx`, `types.ts`, `constants.ts`, `helpers.ts`. Props, constants, and helpers specific to this sub-component live locally.

The barrel stops at sub-component level — do not create barrels for sub-sub-components (internal helpers within a sub-component module).

Name components after their type suffix (`*Header`, `*Section`, `*Grid`, `*Card`, `*List`) — the suffix must match the subdirectory it lives in (e.g. `AnalysisScorecardSection` in `sections/`, `AnalysisGrid` in `grids/`).

- **One component per file** — each `.tsx` file exports exactly one component.
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
