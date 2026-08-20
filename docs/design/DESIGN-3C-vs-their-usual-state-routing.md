# DESIGN-3C — `vs their usual`: state routing when the post's own count was never published

**Scope:** one confirmation for issue #252, section *"Design pass: YES, but much narrower than expected"*.
**Status:** **Approved by the owner on 2026-08-20.** Authored 2026-08-19. **Designer:** Jessica.

> Landed on `main` doc-only. Content is preserved as approved; it is **not** rewritten to match what
> has since shipped in #263. Where the doc and shipped behaviour differ, the doc is the governing
> spec and the difference is tracked as open work (see #262), not silently reconciled here.

This document decides **which existing string appears when**. It introduces no component, no icon, no
colour, no layout change, and no interactive affordance. **OR-25 stands: statement, never a button.**
It does not reopen #251's shipped strings, states 1 or 2, or #209's parked "a better baseline now
exists" affordance.

---

## 1. The decision

**Confirmed — yes.** When a post's **own** metric is unresolved, the not-comparable statement wins
**immediately, regardless of pool size**; the progress counter and `builds as you analyse more` must
never render on that row — **but the string it renders is the trailing clause of #251's string only,
not the whole string, because #251's opening clause (`this creator's usual is set`) is false while the
pool is still below the threshold.**

Rationale: the entire #251/#252 defect family is *copy that asserts something untrue about the row's
own state*. Routing this row to state 3 and then telling it the creator's usual *is* set would fix one
false statement by shipping another. The decisive fact — and the only one that is true in **both**
pool conditions — is the second half of the sentence.

---

## 2. The exact strings

| Case (own metric unresolved) | Rendered string | Provenance |
|---|---|---|
| Pool **≥ threshold** (state 3 as shipped in #251) | `this creator's usual is set — this post's own count wasn't published` | **#251 verbatim, unchanged.** Not reopened. |
| Pool **< threshold** (this ticket's case) | `this post's own count wasn't published` | **Not new copy** — the trailing clause of the string above, verbatim, with the now-false leading clause dropped. No new words are invented. |

Style, casing, punctuation, weight, colour and placement are identical to the shipped
not-comparable cell — muted, single line, plain text, `text-[11px]`, no `—` fallback glyph, no icon,
no affordance. There is **no second line** in either case (no `builds as you analyse more`).

`MEDIAN_ZERO` is unaffected and unreachable below the threshold (no median exists yet), so it needs
no variant.

**If the owner prefers absolute zero-delta**, the fallback is to render #251's full string in both
cases. I do not recommend it: it states as fact ("the creator's usual is set") something the same
table contradicts elsewhere, on the exact rows this ticket exists to make honest. The cost of the
recommended option is **one extra key in the existing `NOT_COMPARABLE_MULTIPLIER_CELL_COPY` record**.

---

## 3. The routing rule (plain language, implementable as written)

Evaluate in this order, per row, on the derived state — **not** in the cell renderer:

1. **A stored multiplier exists** → state 2, `N.N×` / `based on N <bucket noun>`. Frozen. Untouched.
2. **The post's own metric is unresolved** → **state 3 wins, regardless of pool size.**
   - pool ≥ threshold → `this creator's usual is set — this post's own count wasn't published`
   - pool < threshold → `this post's own count wasn't published`
   - No counter, no denominator, no `builds as you analyse more`, on either branch.
3. **Own metric resolved, pool ≥ threshold, median = 0** → state 3, `every earlier post measured zero`.
4. **Own metric resolved, pool ≥ threshold, median > 0** → state 2, live multiplier.
5. **Own metric resolved, pool < threshold** → state 1, the progress counter + `builds as you analyse
   more`. **Unchanged. This is the only state that keeps the promise, and now the promise is true.**

Stated as one sentence for the implementer: **an unresolved own metric is checked before pool size,
because no amount of analysing can recover a number Instagram never published.** This is the same
precedence `computeBaseline()` already uses internally (own-metric check before median-zero); this
extends it one step earlier, ahead of the cold-start check.

**Where it must live:** in the shared state discriminator that `deriveMultiplierCell` consumes, so
every consumer inherits it at once. Routing this only inside the table cell would leave the popover
disagreeing with the cell (see §4.2).

---

## 4. Edge cases the engineering proposal did not cover

**4.1 — #251's string is half-false in this case.** Covered in §1/§2. This is the substantive
finding; "reuse the string verbatim, zero new copy" is *almost* right but ships a false clause.

**4.2 — The popover must follow the cell, not just the cell copy.** A row leaving cold start must also
lose (a) the **F2 footer carve-out** (DESIGN-3B §4.5.1 / B6) and (b) §5 row 5's L2 sentence
`@user has 2 of 5 carousels analysed so far. The comparison appears on its own once the fifth is in.`
That L2 sentence is the promise in longer form; if the cell withdraws it and the popover repeats it,
we have reproduced #251 one layer down. Both already guard on `kind === "cold-start"`, so routing at
the discriminator (§3) makes this automatic — **routing anywhere later breaks it.** No new popover
copy is needed: the not-comparable row uses the default F1 footer and the standard L2, as it does today.

**4.3 — The live sample size must not leak onto these rows.** #251 made the live-count carve-out
depend on `median == null`. This ticket's row has `median == null` **and** is not cold start, so the
live comparator count would still be injected onto it. No counter renders, so it is invisible in the
table — but any surface that reads `sampleSize` (popover, future export, a11y label) could still
say `based on 4 reels` on a row that has no comparison at all. **Gate the live count on
`state === COLD_START`, not on `median == null`.**

**4.4 — Sorting and grouping.** ⚠️ **SUPERSEDED IN PART — owner ruling, 2026-08-20. The sorting half
of this clause no longer holds. The grouping half stands unchanged.**

> **Owner ruling, 2026-08-20 (approved override of this section):** *Drop the sorting entirely. The
> default and only order is `updated_at DESC` — most recently analysed first.*
>
> **The order key was changed from `created_at` to `updated_at` by the owner on 2026-08-20**, after
> the earlier revision of this ruling. Reason: **re-analyze is an `UPDATE`, not an `INSERT`**
> (`lib/server/analysis/pipeline/index.ts:80-89`) and it never touches `created_at`, so a re-analysed
> row would keep its original `created_at` and would **not** move to the top even though an analysis
> had just run for it. The owner wants re-analysed rows to surface. `updated_at` is also **already
> indexed** — `CREATE INDEX idx_analyses_updated_at ON analyses(updated_at DESC)`
> (`migrations/013_reach_unavailable_reason.sql:181`) — whereas `created_at` has no index.
>
> **Reasoning, as stated by the owner:** the shipped sort *lies*. It claims to order by multiplier but
> orders by the **stored** multiplier, and since [#263](https://github.com/jordanjordann/my-content/pull/263)
> made the displayed multiplier live-derived, the 2026-08-20 production census shows the **majority of
> the rows that display a number have none stored**. Removing the sort replaces a wrong answer with
> **no answer**, which is honest. The owner explicitly accepted the trade-off that the two
> currently-correct rows (`3b495116`, `7b6948fe`) also lose their correct ordering, and he chose full
> removal over the alternative of keeping a single date-column sort toggle.
>
> **The order clause is exactly `ORDER BY a.updated_at DESC` — no secondary sort key.** A tiebreak
> (`, a.id ASC`) was proposed and **declined by the owner on 2026-08-20**. `updated_at` is
> `TEXT NOT NULL DEFAULT (datetime('now'))` — one-second granularity, no `UNIQUE` constraint — so two
> rows whose *last* write lands in the same second can tie, and paginated reads could then duplicate
> or drop a row; the owner was told this plainly and **accepted it as low-risk at current scale**.
> Tied-row order is **explicitly undefined and accepted**. See `DESIGN-3C-analyses-table.md` §6.1 /
> amendment A10 for the full evidence, re-derived for `updated_at`. Do not re-argue it, and do not
> propose an index or `UNIQUE` constraint — that is a prohibited migration.
>
> **Consequence the owner accepted:** because every pipeline stage writes `updated_at`, a row
> **climbs to the top while its own analysis is still running** (pending → completed), instead of
> sitting still after insert as it did under `created_at`.
>
> **The owner was told this section declined to change sort semantics and approved the override
> anyway.** It is not a drift, an oversight or a re-reading — it is a decision that overrules this
> paragraph. It also supersedes **§6.1 of `DESIGN-3C-analyses-table.md`** (the sortable-column list,
> the `Posted, descending` default, and rules **R-S1 / R-S2 / R-S3**) and **OR-8**, whose default sort
> key was `post_date`; the new key is `updated_at`, a different column with a visibly different order.
> Ticketed as [#266](https://github.com/jordanjordann/my-content/issues/266).

**What still holds from the original clause:** **grouping**. These rows must still group with the
other **not-comparable** rows, not with cold start, and must not be treated as cold start with
progress `0`. Grouping is a separate axis from ordering — `groupAnalysisRows` splits the page by
score presence and never reads a sort key — so removing the sort leaves grouping untouched.

**What is withdrawn:** every sorting statement here. There is no sortable column left, so "these rows
must **sort** with the other not-comparable rows" has nothing to bind, and the observation that
progress-ranked orderings have no key for these rows is moot. **Original text, preserved so it is not
rebuilt:** *"These rows must sort and group with the other not-comparable rows, not with cold start.
They have no progress value, so any ordering that ranks cold-start rows by progress has no key for
them. No new sort semantics are requested — only: do not treat them as cold start with progress
`0`."*

**4.5 — Screen reader.** The cell announces as the single statement, in full, in one phrase. No
counter, no numeral, nothing to announce as `0 of 5`. Contrast, size and muted treatment are
unchanged from the shipped not-comparable cell, which already meets AA.

**4.6 — The `5 of 5 reels` / `builds as you analyse more` wart does not change this answer.** Those
rows have a **resolved** own metric and are waiting only on the pool; #252 gives them real
multipliers, which is the fix. They never enter the branch decided here. Explicitly out of scope, no
copy proposed for them.

---

## 5. Premises I could not verify

- **"0 rows in this state in production today."** I could not run the read-only Turso query (blocked
  by the sandbox), so this is unverified by me. The screenshot is consistent with it: every cold-start
  row visible has a published own count (`7.1K plays`, `5.5K plays`), and the one row with no plays
  (`Cara Buat Telur Ajaib New York`, image carousel) is measured against **follower count**, which
  resolved. **The row shape to watch** is exactly that one: an image post whose follower count is
  missing would land in this branch immediately.
- **#252's census table (0 MEASURED / 3 NOT_COMPARABLE / 7 COLD_START) is stale.** The current figure
  supplied to this review is 10 completed / 2 MEASURED / 1 NOT_COMPARABLE / 7 COLD_START, which the
  screenshot corroborates (two rows show `8.2×` and `0.2×`).
