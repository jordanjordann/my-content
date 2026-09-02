# Adding a required field to a shared type — the fixture cascade (#252/#263, #260/#261)

Both tickets added a required field to `PerformanceTier2`. Same lessons, twice.

## Enumerate every fixture BEFORE touching source

When a shared type (`PerformanceTier2`) gains a new **required** field, grep for every object-literal
fixture that constructs it across `tests/` first. This repo uses `.toEqual()` (strict) heavily, so every
literal needs the new field or `tsc`/vitest breaks.

Pattern used: `grep -rn "tier2: {" tests` (and `tier2:\s*{` more broadly) to enumerate every fixture,
across both DOM tests and server-side `route.test.ts` / `readModel.test.ts`.

**The ticket's "Files affected" list is routinely incomplete here.** On #260 it missed
`tests/server/analysis/performance/readModel.test.ts`, `tests/api/analyses/route.test.ts`, and several DOM
test files carrying `tier2` literals.

## The TS inference cascade is a false alarm — never paper over it

When a required field is added to a nested type, a fixture literal missing it (`TS2739`) doesn't just error
at that site: **in the SAME FILE**, an unrelated sibling `const X: SomeNullableUnion = {...}` that later
does `{ ...X, computed: {...X.computed} }` can start reporting `X.computed` as `T | undefined`
(`TS2322` / `TS18047`) — even though nothing about `X`'s own type changed. This is TS's handling of
spreading a nullable-typed variable whose *own* literal has an unrelated nested error. **It is a downstream
inference artifact, not evidence the type was loosened.**

**How to verify it is a false alarm rather than a real loosening:** isolate the type-change diff alone (no
test-file edits) in a throwaway worktree, reproduce the same errors, and confirm the diff only **adds**
required fields — never `?`, never `| undefined`, never `any` / `as` / `!`. If reproduced identically, the
cascade will resolve itself once the fixtures are fixed; **do not touch the type.**

**⚠️ Never "fix" the cascade with `!`, `as`, `any`, or `@ts-expect-error`.** A required-property addition is
a *strengthening*; the cascade is expected fallout. Fix the fixtures.

## Deleting a constant: the AC is checked literally, including comments

An acceptance criterion of the form `grep -rn "<CONSTANT>" app lib tests` returns zero hits is checked
**literally**, including inside comments and JSDoc. Deleting the constant's only export is not enough if
old code or prose still names the identifier. **Re-grep after deletion and rephrase any comment that still
names the dead constant** — including comments from earlier tickets (#251's own comments predated #260's
fix).

This codebase pins ticket numbers to almost every comment/JSDoc block, and JSDoc often encodes the "why",
including "MUST stay in sync with X" warnings. **Grep those warnings** to find every place that needs
updating when a fix lands.

## Testing a module-load-time constant

The repo's `vi.stubEnv` + `vi.resetModules()` + dynamic `import()` pattern (established in
`tests/server/analysis/performance/constants.test.ts`) is **required** to test any constant computed at
module load (`export const X = resolveX()`), since these are NOT re-read per call. A static top-level
import cannot test env-driven behaviour.

## Reconciling a test-count discrepancy

A reviewer flagged "914 → 917 tests but ~13 new `it()` blocks — maybe some aren't collected." The real
answer: compare `it(` occurrence counts and actual `vitest run` counts at **BOTH the true base (`main`) and
the head** — not against an intermediate mid-PR commit someone quoted. The "914" baseline came from a
mid-PR commit (`26280a1`), not `main` (903). Against the correct base, +14 tests matched +14 net `it()`
occurrences exactly.

**Lesson: when a reviewer's math doesn't add up, re-derive the true delta by running the suite at true
main and true head — don't trust an intermediate number from the PR narrative.**

**Verifying a `main` baseline correctly:** `git worktree add /tmp/<name> <sha>`, symlink
`node_modules` in from the real checkout (`ln -s /path/to/real/node_modules node_modules`), run
`node_modules/.bin/vitest run` there, then `git worktree remove /tmp/<name> --force`. This is safe
to do from the main checkout without disturbing the in-progress branch. On #266/#268 this caught
that a PR body's own claimed "918 baseline" needed independent re-verification (it happened to be
right, but re-run it — don't just cite an earlier session's number as fact without re-checking).

## Removing a whole feature (not just a field): delete tests, don't re-point them (#266)

`#266` removed analyses-table sorting entirely (8-column sort, `aria-sort`, `sortBy`/`sortDir` params) —
not a field rename, a full withdrawal, with a design-doc amendment (A10) marking the old rules WITHDRAWN.

- **The reviewer's yardstick that matters here:** *a test expectation changed to accommodate a code change
  is only correct if the consumer contract agrees.* Before rewriting any assertion, name the contract that
  makes the NEW expectation right — not just that it now passes. A ticket that lays this out explicitly
  (table of file/lines/contract) is doing your due-diligence for you; use it, don't skip past it to the
  code.
- **A withdrawn rule's test gets DELETED, not adapted**, when nothing is left for the rule to bind (e.g.
  R-S1 "absent values sink to the bottom" — with no sortable column, there is no sort direction for a value
  to sink within). Don't invent a same-shaped replacement assertion just to keep the test count stable.
- **Do NOT reintroduce a declined guarantee via a "helpful" replacement test.** The ticket explicitly warned
  against writing an identical-`updated_at` pagination-stability test to replace the deleted `a.id ASC`
  tiebreak test — that would assert a contract (stable order for tied rows) the code deliberately does not
  offer anymore. If a ticket says "do not test X", grep your own diff for anything that accidentally tests
  X anyway before finishing.
- **A fixture helper that never set the column being asserted on makes the OLD assertion vacuous once the
  sort key changes.** `insertAnalysis()` never set `updated_at`, so every row got the same
  `datetime('now')` value within a test — an order assertion against it would pass regardless of actual
  order. Add the column explicitly to the fixture args and set genuinely distinct values before trusting
  the rewritten test.
- **A request-dedupe regression-guard test that used `sortBy`/`sortDir` as its "mismatched params" fixture
  needs a NEW way to produce two structurally different objects** once those fields are gone (e.g. one call
  site passing an extra `page` key vs. the other omitting it) — the assertion (TanStack Query's key hashing
  is shape-sensitive) survives; only the shape it exercises has to move.
- **Net test-count math after a feature removal is additive across several files** — reconcile it file by
  file (deleted vs. added `it()` per file), not as one aggregate number, so a reviewer can audit each delta
  against its own contract.

## Review round 2 on #266 (PR #268): a fixture setting a distinct column is not the same as a test
consuming it

A reviewer caught that the 63-row page-boundary test in `analyses.pagination.test.ts` set distinct
`updated_at` per row but the assertions only checked `.length`, `.total`, and set-union/no-overlap
across page 1 and page 2 — **never actually compared the returned order to the expected order**. It
would have passed identically under `ORDER BY a.username ASC` or with no `ORDER BY` at all. Setting a
distinct fixture column is necessary but not sufficient — grep your own assertions for whether they
actually consume the column you made distinct, not just whether the fixture varies it.

**The fix pattern:** build the expected order directly from the fixture-insertion sequence
(`[...ids].reverse()` when insertion was ascending and the query is `DESC`), then `toEqual()` the
full page-1 and page-2 id arrays against slices of it — not just `.length`/`Set` membership.

**Mutation-proof workflow, concretely, for an `ORDER BY` clause (do both mutations, not just one):**
1. Edit the production `ORDER BY` to a *different but still-valid* column (e.g. `a.username ASC`) via
   the Edit tool. Run the specific test file. Confirm it fails with a real assertion diff.
2. Edit the production code again to **delete the `ORDER BY` clause entirely**. Run again. Confirm it
   fails again (SQLite gives no ordering guarantee without one — deleting the clause is a distinct
   failure mode from swapping the column, both must be tried).
3. Revert via the Edit tool (not `git checkout --`). Confirm `git diff <file>` is empty and the suite
   is green again before moving on.
A test that only fails one of the two mutations (or neither) is not proven — report the actual
observed failure output for each mutation, don't assume from reading the assertion.

**A `not.toHaveClass("hover:text-foreground")` assertion alone can't catch every regression** — a
different `hover:*-foreground`-shaped class would slip past a single literal string match. Add a
second, broader guard: `expect(el?.className).not.toMatch(/(?:^|\s)hover:/)` (and the `focus-visible:`
equivalent) alongside the literal-class check, when the surviving guarantee is "no override of this
*kind* exists," not just "this one exact class is absent." Verify by temporarily reintroducing the
literal class you deleted (e.g. re-add `hover:text-foreground` to the component) and confirming the
new test fails, then revert via the Edit tool.

**A withdrawn interactive state (hover/focus-visible) still needs a regression test after the
element becomes non-interactive**, when the ticket names those states as SURVIVING (not withdrawn)
even though the affordance that used to carry them (a `<button>`) is gone. "The old test doesn't
apply to a `<span>`" is not the same as "no test is needed" — the underlying colour-unconditional
guarantee (R-D18 here) still needs a test that would fail if someone re-added the competing class to
the new element (`<th>`/`<span>`) that replaced the old one (`<button>`).
