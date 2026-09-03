# TDD — Responsive Sidebar & Table (Issue #284)

**Author:** John (Technical Lead)
**Date:** 2026-09-03
**Issue:** [#284](https://github.com/jordanjordann/my-content/issues/284) — audit finding F-13 (P1)
**Design source of truth:** `docs/design/284-responsive-sidebar.md` (Rev 2) + `docs/design/284-responsive-sidebar-mockup.html`
**Owner rulings that SUPERSEDE the spec:** recorded in §1.2 below.

---

## 1. Scope and settled decisions

### 1.1 Carried from the approved design (do not re-open)

| Decision | Value |
|---|---|
| Breakpoint | `lg:` = **1024px** (Tailwind v4 default `64rem`; this repo defines no custom `--breakpoint-*` in `app/globals.css`, so `lg:` is exactly 1024px) |
| States below `lg` | **COMPACT** (64px rail, in flow, pushes content, plain `<nav>`) and **EXPANDED** (256px overlay + scrim, `role="dialog" aria-modal="true"`, background `inert`). No "closed" state, no hamburger. |
| State at/above `lg` | **PERSISTENT** — 256px static sidebar, `pl-64` main. Zero visual change from today. |
| Toggle location | First item inside the rail. Chevron. `aria-expanded` / `aria-controls`. Not in the page header. |
| Expand behaviour | Always overlays, never pushes, across the entire sub-`lg` range including 768px. |
| Nav tap while expanded | Does **not** auto-collapse. |
| Expanded width | `min(256px, 100vw - 48px)` |
| Compact rail width | 64px, with a **pre-approved 56px fallback** if 64px proves too tight (developer must state it in the PR if taken) |
| Table below `lg` | Stacked cards `< 640px`; horizontal-scroll table with **sticky first column** `640–1023px`; toolbar `flex-wrap` |

### 1.2 Owner rulings that override the design spec

1. **No state persistence at all.** This supersedes spec §3.2 and §11 Q2. No `localStorage`, no `sessionStorage`, no cookie, no URL param. State is plain React state in the `Sidebar` client component. A hard reload always lands on the breakpoint default: **expanded at `lg`+, compact below `lg`**.
2. **Sticky first column is in scope now** (spec §2 decision 2, confirmed).
3. **`min(256px, 100vw - 48px)`** expanded width is approved (spec §11 Q1 resolved).
4. **56px fallback pre-approved** (spec §11 Q3 resolved).

### 1.3 Hard constraint

**At ≥1024px the rendered DOM and computed styles must be indistinguishable from `main` today.** Any desktop delta is a bug, not a trade-off. Every new class must be either a sub-`lg` class or reset by an `lg:` variant.

---

## 2. Codebase reality — what the design collides with

Read before planning: `components/Sidebar/Sidebar.tsx`, `app/app/layout.tsx`, `app/app/analyses/components/AnalysesContent/AnalysesContent.tsx`, `app/app/analyses/components/grids/AnalysisDataTable/AnalysisDataTable.tsx` (+ its `constants.ts`, `components/rows/AnalysisTableRow.tsx`, `components/headers/AnalysisTableColumnHeaders.tsx`, `components/states/AnalysisTableEmptyState.tsx`).

### C-1 — The sidebar has exactly one consumer. Low blast radius.

`components/Sidebar/index.tsx` → `Sidebar` is imported in **exactly one place**: `app/app/layout.tsx` (`<Sidebar>{children}</Sidebar>`). It is a `"use client"` component already, and it wraps `<main>` itself. So the rail work is contained to `components/Sidebar/**`. `app/app/layout.tsx` does **not** need to change.

### C-2 — The table already has a horizontal scroll container. The 795px overflow is probably NOT the table.

`AnalysisDataTable.tsx` already wraps the `<table>` in `<div className="relative max-h-[720px] w-full overflow-auto">`, and `AnalysisTableColumnHeaders` sets `style={{ width, minWidth }}` per `<th>`. The nine default column widths sum to **1288px** (`300+140+108+132+84+156+128+116+124`), so the table already has an intrinsic min-width of ~1288px inside a container that already scrolls. Two consequences:

- The design's "wrap the table in `overflow-x-auto`" is **already done**. The remaining work is the sticky column, not the scroll container.
- **The audit's 795px page overflow at 768px is therefore unexplained by the table.** Prime suspects: the footer bar in `AnalysisDataTable.tsx` (a deliberately non-wrapping `flex` row carrying a ~750px max-content sentence plus a ~350px pagination group — see the R-D11 comment in that file), the toolbar row, or `AnalysisFilterSection`'s `min-w-[220px]` search field. **The implementer must measure the real overflow source in a browser at 768px with data present before changing anything**, and report the measured `scrollWidth`/`clientWidth` per candidate element in the PR. Do not assume.

### C-3 — Sticky-left cannot be unconditional, because the desktop table already scrolls horizontally.

At 1440px, available content width is 1440 − 256 (sidebar) − 48 (`p-6` both sides) ≈ 1136px, under the table's 1288px intrinsic width. So the desktop table **already** scrolls inside its wrapper today. Adding `position: sticky; left: 0` to column 1 unconditionally would visibly change desktop behaviour and violate §1.3. **The sticky treatment must be gated off at `lg`** (`sticky left-0 … lg:static lg:z-auto lg:shadow-none` or equivalent), even though it would arguably be an improvement on desktop. If the owner wants it on desktop too, that is a separate ticket.

### C-4 — Rail semantics need JS; rail *geometry* must stay pure CSS.

Widths, padding and the `lg:` reset must be Tailwind variant classes (`w-16 lg:w-64`, `pl-16 lg:pl-64`) so the correct layout paints on the server-rendered HTML with no JS and no flash, and so `lg:` guarantees §1.3 mechanically.

But `role="dialog"`, `aria-modal`, `inert` on `<main>`, the focus trap and the `Esc` handler **cannot** be expressed in CSS, and they must **not** leak to desktop. Example failure mode: a user expands the rail at 900px, then widens the window to 1200px — CSS snaps the sidebar to the persistent 256px, but `role="dialog"` and `inert` on `<main>` are still on, so the whole desktop app is unreachable by keyboard and screen reader.

**Resolution:** one `matchMedia` hook, `useIsBelowBreakpoint("lg")`, is the single source of truth for *semantics only*. SSR/first-render value is `false` (desktop), which matches today's server HTML exactly — no hydration mismatch. Because the default state below `lg` is COMPACT (non-modal, non-inert), the pre-hydration semantics are already correct on mobile too; nothing flashes.

### C-5 — Card view vs. table view: mount one, not both.

Rendering both a `<table>` and a card list and hiding one with `hidden`/`sm:block` doubles the DOM for up to 50 rows × 10 cells (including popovers and tooltips). Use the same `matchMedia` hook to mount exactly one. The usual "flash of wrong layout before hydration" objection does not apply here: `AnalysisDataTable` fetches client-side and paints `SKELETON_ROW_COUNT` skeleton rows first (`isPending`), so `matchMedia` has resolved long before real rows exist. State this reasoning in the PR.

### C-6 — DESIGN GAP: the card layout's field list is not specified, and dropping fields is a documented invariant violation.

Spec §8 says cards show "key fields as labeled key-value pairs" but never enumerates them. The table has a hard rule (`LOCKED_COLUMN_IDS` in `AnalysisDataTable/constants.ts`, DESIGN-3C §6.3 / R-12.3.1): **`content`, `performance`, `engagementReach`, `engagementFollowers` can never be hidden**, because "hiding a denominator-bearing column is how a user, not a developer, violates it". A card that silently drops `Eng. / reach` vs `Eng. / followers`, or renders a ratio without its denominator label, reproduces exactly the failure that rule exists to prevent.

**Engineering ruling for this TDD (flagged to the owner in §9 as an open question):** the card renders, at minimum, every column in `LOCKED_COLUMN_IDS`, each with a visible text label, reusing the existing cell components (`AnalysisContentCell`, `AnalysisEngagementCell` with its `denominator` prop, the performance cell logic) unchanged. Optional columns may be omitted. No new copy is invented.

### C-7 — Empty/error/skeleton states are table-shaped.

`AnalysisTableEmptyState` and `AnalysisTableErrorState` render `<tr><td colSpan=…>`. They cannot be reused inside a card list. The card list needs its own non-table wrappers around **the same copy and the same components' children** — do not fork the strings.

Pre-existing bug noticed in passing, **explicitly out of scope**: `AnalysisTableEmptyState` uses `colSpan={ANALYSES_TABLE_COLUMNS.length}` (always 9) instead of the caller's `displayColumns.length` (10 when Style is on). Left alone to avoid a file conflict; file a separate P3 if wanted.

### C-8 — `next.config.ts` does not enable `cacheComponents`.

So React `<Activity>` route-state preservation (`node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`) is **not** in play. The `Sidebar` lives in `app/app/layout.tsx`, above the page, so it does not unmount on SPA navigation anyway — expanded-stays-expanded across in-app nav (spec §3.2) is free, requiring no code. Do not add a persistence layer to achieve it.

### C-9 — jsdom has no layout engine and a stub `matchMedia`.

`vitest.config.ts` runs a `jsdom` project over `tests/**/*.dom.test.{ts,tsx}` (files **must** carry the `.dom.` segment or they run in no project at all). jsdom reports zero for every measurement and its `matchMedia` never matches and never fires change events. Therefore:

- Breakpoint **behaviour** is unit-tested by stubbing `window.matchMedia` with a controllable fake (created once in T1, reused by T2/T4).
- Breakpoint **geometry** (does `w-16` actually equal 64px at 375px) is verified by (a) literal, whole-string assertions on the rendered `class` attribute in jsdom, and (b) a manual browser measurement recorded in the PR body. Neither alone is sufficient; both are required.

---

## 3. Architectural pattern

No data model, no API, no migration. This is presentation-layer only.

```
lib/hooks/useIsBelowBreakpoint/     [NEW]  matchMedia wrapper — the ONE breakpoint source of truth
        │
        ├── components/Sidebar/     [MODIFY] COMPACT/EXPANDED rail; geometry in CSS, semantics from the hook
        │       └── consumed by app/app/layout.tsx (unchanged)
        │
        └── app/app/analyses/components/grids/AnalysisDataTable/
                ├── [MODIFY] toolbar flex-wrap, sticky col 1 (<lg only), table/card mount switch
                └── components/lists/AnalysisCardList/  [NEW]  <640px stacked cards
```

Data-transformation rule (`AGENTS.md`): **nothing new is transformed.** Cards consume the same `AnalysisListItemIndexed` rows, including the `row.tableDerived` block already produced by the `select` in `lib/api/analyses/hooks.ts`. **No new `useMemo` reshaping in the card components, and no new `select`.**

---

## 4. `useIsBelowBreakpoint` — design

**Location:** `lib/hooks/useIsBelowBreakpoint/` (new). Module shape per `AGENTS.md`: `index.ts` (barrel), `useIsBelowBreakpoint.ts`, `constants.ts`, `types.ts`.

```ts
// constants.ts — must stay in lockstep with Tailwind v4 defaults; app/globals.css sets no overrides.
export const BREAKPOINT_PX = { sm: 640, md: 768, lg: 1024 } as const;

// types.ts
export type BreakpointName = keyof typeof BREAKPOINT_PX;

// useIsBelowBreakpoint.ts
export function useIsBelowBreakpoint(name: BreakpointName): boolean;
```

Behaviour contract:

1. Query string is exactly `(max-width: ${BREAKPOINT_PX[name] - 0.02}px)` — `1023.98px` for `lg`, `639.98px` for `sm`. The 0.02px step avoids the fractional-viewport dead zone between `max-width: 1023px` and Tailwind's `min-width: 1024px`.
2. **Returns `false` on the server and on the very first client render**, so SSR HTML equals today's desktop HTML. Implemented with `useState(false)` + `useEffect`, **not** `useSyncExternalStore` with a matching `getServerSnapshot` shortcut — `false` must be the literal initial value in both environments.
3. Subscribes with `mql.addEventListener("change", …)`, unsubscribes on cleanup. `addListener` (deprecated) is not used.
4. Guards `typeof window === "undefined"` and `typeof window.matchMedia !== "function"` — returns `false` and subscribes to nothing.
5. Re-subscribes when `name` changes.

**Test harness (created here, shared later):** `tests/setup/matchMediaStub.ts` exporting `installMatchMediaStub()` → `{ setMatches(query: string, matches: boolean), restore() }`. It must record which query strings were requested, so tests can assert the literal string `"(max-width: 1023.98px)"` was the one asked for.

---

## 5. `Sidebar` — design

**Target module shape** (`AGENTS.md`):

```
components/Sidebar/
├── index.tsx                            (MODIFY — re-export Sidebar + types)
├── Sidebar.tsx                          (MODIFY — orchestrator)
├── types.ts                             (MODIFY)
├── constants.ts                         (CREATE)
├── helpers.ts                           (CREATE — pure focus-trap helper)
└── components/
    ├── toggles/
    │   └── SidebarRailToggle.tsx        (CREATE — flat file, suffix matches folder)
    ├── scrims/
    │   └── SidebarScrim.tsx             (CREATE — flat file)
    └── links/
        └── SidebarNavLink.tsx           (CREATE — flat file)
```

Flat sub-component files (no barrels, no local types) — each is small and single-purpose; their props live in `components/Sidebar/types.ts`. One component per file.

### 5.1 State

```ts
const isBelowLg = useIsBelowBreakpoint("lg");          // semantics only
const [isExpanded, setIsExpanded] = useState(false);   // meaningful ONLY when isBelowLg
const isModal = isBelowLg && isExpanded;               // the single derived gate
```

- **No persistence** (§1.2.1). `useState(false)`, no initialiser reading storage.
- `useEffect(() => { if (!isBelowLg) setIsExpanded(false); }, [isBelowLg])` — resizing up to desktop and back down lands on COMPACT (spec §3.2, third bullet) and guarantees `isModal === false` on desktop even before the state settles.
- Nav clicks do **not** touch `isExpanded` (owner decision).

### 5.2 Geometry — pure Tailwind, `lg:` resets everything

| Element | Class | Result <1024 | Result ≥1024 |
|---|---|---|---|
| `<aside>` base | `fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-sidebar/95 backdrop-blur` | unchanged | unchanged (identical to today) |
| `<aside>` width, COMPACT | `w-16 lg:w-64` | 64px | 256px |
| `<aside>` width, EXPANDED | `w-[min(256px,100vw-48px)] lg:w-64` | ≤256px overlay | 256px |
| `<main>` | `pl-16 lg:pl-64 min-h-dvh` | 64px reservation, never 256 | **`pl-64`, byte-identical to today** |

`<main>`'s padding never changes with `isExpanded` — that is what makes EXPANDED an overlay rather than a push (spec §3.4).

Transition: `transition-[width] duration-200 motion-reduce:transition-none` on the `<aside>`; scrim `transition-opacity duration-200 motion-reduce:transition-none`. `motion-reduce:` is Tailwind's built-in `prefers-reduced-motion: reduce` variant — use it, do not hand-roll a media query.

### 5.3 Semantics

**COMPACT (`isBelowLg && !isExpanded`) and PERSISTENT (`!isBelowLg`)**

- `<aside>` carries no `role`, no `aria-modal`.
- Inner `<nav id="app-nav" aria-label="Main">`.
- `<main>` has **no** `inert` and **no** `aria-hidden`.

**EXPANDED (`isModal`)**

- `<aside role="dialog" aria-modal="true" aria-label="Navigation">` wrapping the same `<nav id="app-nav" aria-label="Main">`.
- `<SidebarScrim>` rendered: `fixed inset-0 z-30 bg-black/60 lg:hidden`, `aria-hidden="true"`, `onClick` collapses. It is not a focus target and is not the accessible close control — `Esc` and the toggle are.
- `<main inert>` — React 19.2 supports `inert` as a real boolean prop (`inert={isModal || undefined}`; do **not** pass `inert=""` or the string `"true"`). Also set `aria-hidden={isModal || undefined}` as the fallback the spec asks for.

**Toggle** (`SidebarRailToggle`, rendered only when `isBelowLg`; additionally `lg:hidden` as a CSS belt-and-braces so it is out of the tab order even in the one frame before hydration):

```
<button
  type="button"
  aria-controls="app-nav"
  aria-expanded={isExpanded}                    // literal true/false
  aria-label={isExpanded ? "Collapse navigation" : "Expand navigation"}
  className="… size-11 …"                       // 44×44 exact
>
```

Chevron: `»` glyph when collapsed, `«` when expanded (`lucide-react` `ChevronsRightIcon` / `ChevronsLeftIcon`, `aria-hidden="true"` — the button's `aria-label` is the accessible name).

**Nav link** (`SidebarNavLink`): always renders the icon plus a `<span>` label. In COMPACT the label span gets `sr-only lg:not-sr-only` so it disappears visually but stays in the accessibility tree; the link additionally carries an explicit `aria-label="Analyses"` so the name is stable in every state (spec §10). `aria-current="page"` when `pathname?.startsWith("/app/analyses")`. Active affordance is three redundant cues (spec §3.1): filled vs. outline icon, accent colour, and a 3px left accent bar. Tap target `min-h-11` in COMPACT.

**Labels vanish, never truncate** (spec §3.1). The brand wordmark block is `hidden lg:block` in COMPACT; the 36×36 brand mark stays.

### 5.4 Focus management

- **Expand:** move focus to the toggle button (spec §10 — "I'd default to the toggle since it's visually first"). It is already focused when expansion was toggle-initiated; call `.focus()` unconditionally anyway so the behaviour is identical however expansion was triggered.
- **Collapse (toggle / scrim / `Esc`):** always `toggleRef.current?.focus()`.
- **Trap while `isModal`:** a `keydown` listener on the `<aside>` handling `Tab`/`Shift+Tab`. Pure helper in `helpers.ts`:
  ```ts
  export function getTrapFocusTarget(
    focusables: HTMLElement[], activeIndex: number, shiftKey: boolean,
  ): HTMLElement | null   // wraps last→first and first→last; null when no wrap needed
  ```
  Unit-testable with plain arrays, no DOM — this is where the mutation-resistant index assertions live.
- **`Esc`:** `keydown` listener attached **only while `isModal`**, removed on collapse and on crossing to `lg`. Never a global always-on listener.

### 5.5 JSDoc rewrite (P3, issue #284's "while in the file")

Delete the false claim *"App sidebar with navigation links and a collapsible layout wrapper."* Replace with a description of the real mechanism: two states below `lg` (64px icon rail that pushes content; 256px overlay drawer with scrim and dialog semantics), one persistent 256px panel at `lg` and above, geometry in Tailwind `lg:` variants and semantics gated on `useIsBelowBreakpoint("lg")`, no persistence of any kind. **A deletion with no replacement fails this ticket.**

---

## 6. Table below `lg` — design

### 6.1 Toolbar (`AnalysisDataTable.tsx`, the `border-b p-2` row)

`flex items-center justify-end gap-2` → `flex flex-wrap items-center justify-end gap-2`. The Density buttons keep their `rounded-r-none` / `rounded-l-none` pairing, so the segmented control must not wrap **between** its two halves — wrap the `Columns` menu + `Density` label + segmented group so the segmented `<div className="inline-flex">` is one unwrappable flex item. Touch height ≥44px below `lg` only (`h-11 lg:h-8` or equivalent on the buttons), so desktop button height is unchanged (§1.3).

### 6.2 Sticky first column (640–1023px only)

Applied to the `content` column's `<th>` (in `AnalysisTableColumnHeaders.tsx`) and its `<td>` (in `AnalysisTableRow.tsx`), identified by `column.id === "content"` — never by array index.

```
sticky left-0 z-20 bg-card shadow-[2px_0_4px_-2px_rgba(0,0,0,0.5)]
lg:static lg:z-auto lg:bg-transparent lg:shadow-none
```

- `<thead>` is already `sticky top-0 z-10`. The header's content cell must therefore be **sticky on both axes** and out-rank the body's sticky cell: `thead th[content]` → `z-30`; `tbody td[content]` → `z-20`; everything else default. Concrete stacking contract, to be asserted literally in tests: **header-content 30 > body-content 20 > thead 10 > plain cells 0.**
- Background must be **opaque and row-matching**, not `bg-card` alone — rows have `hover:bg-muted/50` and failed rows a rose left border. Use `bg-card` on the cell plus `group-hover:bg-muted` handling, or accept that hover under the sticky cell is the row background; whichever is chosen must be verified visually mid-scroll at 768px and stated in the PR.
- Add a fixed width to the content column below `lg` (design says ~180–220px; use **200px**, `lg:` back to the existing 300px) so the sticky band does not eat the viewport. Title already truncates (`truncate` in `AnalysisContentCell`) — no change needed there.
- **Do not change the `overflow-auto` wrapper.** It already exists (C-2).

### 6.3 Stacked cards (<640px)

New module, `AGENTS.md`-shaped:

```
app/app/analyses/components/grids/AnalysisDataTable/components/lists/AnalysisCardList/
├── index.tsx        (barrel)
├── AnalysisCardList.tsx
├── types.ts
└── components/
    └── cards/
        └── AnalysisSummaryCard.tsx   (flat file; props in AnalysisCardList/types.ts)
```

- `AnalysisCardList` receives the **already-computed** `pageRows`/`groups`, `density` is ignored (cards have one density), and `onOpen`. It performs **no filtering, no slicing, no sorting, no reshaping** — `AnalysisDataTable` stays the single owner of that logic (`AGENTS.md` data rules; and it keeps the table and cards provably showing the same rows).
- `AnalysisSummaryCard` is a `<button>` (or `<li><button>`) so tap-to-open is native, ≥44px tall, `aria-label` naming the post.
- Field set — C-6: thumbnail + title (`AnalysisContentCell`), then labelled key–value rows for **Performance**, **Eng. / reach**, **Eng. / followers** (reusing `AnalysisEngagementCell` with its existing `denominator` prop so the denominator is never dropped), plus Creator and Posted. Absent-value copy comes from the existing cell components — **invent no new strings.**
- Sink groups: the scoreless / failed dividers become plain `<p>` separators using the **identical label strings** already built in `AnalysisDataTable.tsx`, hoisted to `constants.ts` there so both call sites read one constant. Do not retype the sentence.
- Empty / no-match / error / skeleton: C-7. Non-table wrappers around the same copy.
- Mount switch in `AnalysisDataTable.tsx`:
  ```ts
  const isBelowSm = useIsBelowBreakpoint("sm");
  … isBelowSm ? <AnalysisCardList … /> : <div className="relative max-h-[720px] w-full overflow-auto"><table …/></div>
  ```
  Exactly one of the two is in the DOM at a time (C-5).

### 6.4 Empty state (spec §9)

No code change expected: once `<main>` reserves 64px instead of 256px, `AnalysisEmptySection` / `AnalysisTableEmptyState` fit. Verify at 375px and report the measured `scrollWidth === clientWidth` in the PR. If a change proves necessary it belongs to the card ticket.

---

## 7. Ticket plan

| # | Issue | Type | Title | Depends on |
|---|---|---|---|---|
| T1 | [#334](https://github.com/jordanjordann/my-content/issues/334) | FE | `useIsBelowBreakpoint` hook + `matchMedia` test stub | — |
| T2 | [#336](https://github.com/jordanjordann/my-content/issues/336) | FE | Sidebar COMPACT/EXPANDED rail + JSDoc rewrite | T1 |
| T3 | [#335](https://github.com/jordanjordann/my-content/issues/335) | FE | Table toolbar wrap + sticky first column (<`lg`) | — (parallel with T1/T2) |
| T4 | [#337](https://github.com/jordanjordann/my-content/issues/337) | FE | Stacked card list <640px | T1 **and** T3 (shares `AnalysisDataTable.tsx` with T3) |
| T5 | [#338](https://github.com/jordanjordann/my-content/issues/338) | QA | Manual responsive + a11y verification at 375 / 640 / 768 / 1024 / 1440 | T2, T3, T4 |

### 7.1 File-overlap matrix (dispatch-critical)

| Ticket | Files it may touch |
|---|---|
| **T1** | `lib/hooks/useIsBelowBreakpoint/**` (new), `tests/setup/matchMediaStub.ts` (new), `tests/lib/hooks/useIsBelowBreakpoint/*.dom.test.tsx` (new) |
| **T2** | `components/Sidebar/**`, `tests/components/Sidebar/*.dom.test.tsx` (new) — **reads** T1's hook, does not edit it |
| **T3** | `…/AnalysisDataTable/AnalysisDataTable.tsx`, `…/AnalysisDataTable/constants.ts`, `…/components/headers/AnalysisTableColumnHeaders.tsx`, `…/components/rows/AnalysisTableRow.tsx`, its own new tests |
| **T4** | `…/AnalysisDataTable/AnalysisDataTable.tsx` ⚠, `…/AnalysisDataTable/constants.ts` ⚠, `…/components/lists/AnalysisCardList/**` (new), its own new tests |
| **T5** | none (manual) |

- **Safe in parallel:** T1 ∥ T3. Disjoint file sets.
- **Serialize T1 → T2:** T2 imports the hook; if T2 starts first it will stub or duplicate it.
- **Serialize T1 → T4** and **T3 → T4**: T3 and T4 both edit `AnalysisDataTable.tsx` and `AnalysisDataTable/constants.ts`. This is exactly the `UrlChipInput.tsx` collision that broke the previous session. **T4 must not start until T3 is merged to `main` and T4's worktree is rebased on it.**
- Practical order: `[T1 ∥ T3]` → `[T2 ∥ (T4 after T3 merges)]` → `T5`.

### 7.2 Mutation-resistance rules — apply to every ticket

Reviewers mutation-test this repo. These are requirements, not suggestions:

1. **Literal expectations only.** `expect(main.getAttribute("class")).toBe("pl-16 lg:pl-64 min-h-dvh")`, not `expect(main.className).toContain(PADDING_CLASS)` and not any assertion comparing two values that both derive from the same constant. If flipping a production constant leaves the test green, the test is worthless.
2. **Assert the rendered DOM, never source text.** No `readFileSync` + `grep` on `.tsx`. Everything goes through `@testing-library/react` `render()` and real queries/attributes.
3. **Paired / indexed assertions.** Not "a toggle exists and a nav link exists" — one `toEqual` over an ordered array of tuples, e.g.
   `expect(items.map(el => [el.tagName, el.getAttribute("aria-label")])).toEqual([["BUTTON","Expand navigation"],["A","Analyses"]])`.
   This catches reordering, duplication and omission, which independent existence checks do not.
4. **No bare `toBeInTheDocument()` as the only assertion** for anything with attributes or ordering.
5. **Both branches of every breakpoint conditional**, asserted with the matchMedia stub flipped both ways in the same file, with **different literal expected values** per branch.
6. **Test file naming:** any DOM test **must** be `*.dom.test.tsx` under `tests/`, or `vitest.config.ts`'s two project globs match it in neither project and it silently never runs.
7. **Responsive/visual criteria** are verified in a real browser at exact widths, with the numbers (`scrollWidth`, `clientWidth`, `getBoundingClientRect().width`) pasted into the PR body. "Looks fine on mobile" is a failed acceptance criterion.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Desktop regression (§1.3) | Every new class is sub-`lg` or `lg:`-reset. T2 and T3 each carry an explicit test asserting the **literal whole `class` string** of `<main>` and of the content `<th>`/`<td>` in the `lg` branch. |
| `inert` leaking to desktop | `isModal = isBelowLg && isExpanded`, plus the reset effect on `isBelowLg`. Tested by flipping the stub while expanded and asserting `main.hasAttribute("inert") === false`. |
| 795px overflow root cause unknown (C-2) | T3 must measure first and report the numbers; the fix follows the measurement. |
| Cards dropping a denominator (C-6) | Locked columns are mandatory on the card; `AnalysisEngagementCell`'s `denominator` prop is reused verbatim. |
| Sticky column + sticky header z-fighting | Explicit 30/20/10/0 stacking contract (§6.2), asserted as literal class strings. |
| jsdom cannot prove 64px (C-9) | Dual verification: literal class assertions **and** browser measurements in the PR. |
| T3/T4 file collision | Hard serialization (§7.1). |

## 9. Open questions for the owner

1. **C-6 — card field list.** The design does not enumerate the card's fields. I have ruled that all four `LOCKED_COLUMN_IDS` are mandatory with visible labels. Confirm, or send it back to Jessica for an explicit field list before T4 is dispatched.
2. **C-2 — the 795px overflow at 768px is not explained by the table**, which already has an `overflow-auto` container. T3 is written to measure first. If the real source turns out to be the table footer's deliberately non-wrapping bar (guarded by the R-D11 comment), changing it contradicts an existing design ruling and will need one from you.
3. **C-3 — sticky first column is deliberately disabled at `lg`+**, purely to honour "zero visual change on desktop", even though the desktop table already scrolls horizontally and would benefit. Want a follow-up ticket to enable it on desktop too?
