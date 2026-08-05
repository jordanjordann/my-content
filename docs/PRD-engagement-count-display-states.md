# PRD — Engagement Count Display States

**Status:** Approved for dev handoff
**Owner:** Oden (product owner)
**Author:** Dan (PM)
**Created:** 2026-07-24
**Sources:** Owner brief for this PRD (2026-07-24, four states + treatments settled). Dependency confirmed against PR #95 (ticket #71) — adds `like_and_view_counts_disabled`, migration 009 `play_count` column, and persists `view_count`/`play_count` separately without collapsing them. Existing tooltip pattern from ticket #70 (scorecard rubric tooltips). `AGENTS.md` data-transformation rules.

---

## 1. Executive Summary

- **Problem Statement:** Engagement counts (views, plays, likes) shown in the analyses list/table, cards, and detail modal collapse several genuinely different states into one indistinguishable display — usually a misleading `0`. Unknown, hidden, and truly-zero data all look the same, which is exactly the "fabricated/unknown data renders identically to real data" failure pattern this project has committed to avoiding.
- **Proposed Solution:** A display-layer-only change that renders four distinct engagement-count states with four visually distinct treatments, applied consistently across every surface that shows a count. No new backend fields (Case 1's flag is already being persisted by an in-flight dependency).
- **Success Criteria:**
  1. Every count-displaying surface (list/table, cards, detail modal) renders each of the four states with its correct, distinct treatment — verifiable against a fixture per state.
  2. A user can tell "hidden by creator" from "genuinely zero" from "unknown" from "plays shown instead of views" without opening dev tools or the raw payload.
  3. Zero count-displaying surfaces render a bare `0` for a non-zero-truth state (no false zeros remain).
  4. State-determination logic lives in the query-hook layer (`select`), not in UI components (verifiable by code review).
  5. The "Hidden" affordance uses a neutral info icon + tooltip, reusing the ticket #70 tooltip pattern — not a warning/error/alert styling.

---

## 2. The Problem

Counts are currently nulled or zeroed at the display boundary, so four distinct realities become one ambiguous glyph:

- A post where the creator **disabled** like/view counts looks identical to a post with **no data**.
- A post with a **genuine 0** views looks identical to both of the above.
- A Reel that reports `view_count = 0` but has a real `play_count` shows `0` — actively wrong, hiding a real number (e.g. 116,333 plays).

For an agency judging content performance, a wrong or ambiguous engagement number is worse than no number: it silently corrupts the comparison the whole tool exists to support.

---

## 3. The Four States (SETTLED — do not reopen)

Each state below is an owner-settled decision. Implementation must reproduce these treatments exactly.

| # | State | How it's identified | Required treatment |
|---|---|---|---|
| 1 | **Counts disabled by creator** | Backend reports `like_and_view_counts_disabled = true` (Instagram creator hid like/view counts). Dependency: PR #95 / ticket #71. | Render the word **"Hidden"** with a **neutral info icon + tooltip**. Tooltip copy explains the creator disabled view and like counts on this post. **NOT** a warning/error/alert icon — nothing is wrong, it is a creator choice. |
| 2 | **Genuinely zero** | A real, known `0` (counts not disabled, value present and equal to 0). | Render **"0"**. |
| 3 | **Unknown / never fetched** | No value at all — null/absent, never populated. | Render a neutral **"—"** (em dash), visually distinct from both "0" and "Hidden". |
| 4 | **View count zero but play count exists** | `view_count = 0 AND play_count > 0` — pure derivation from two already-persisted columns. | Render the **play count**, **explicitly labelled as plays, not views** (e.g. "116,333 plays"). |

**Case 4 is a pure display-layer derivation, not a new backend field.** `view_count` and `play_count` are already separate persisted DB columns (confirmed in PR #95). The owner explicitly decided **against** a stored flag for this case, because it is a pure function of two existing columns and a stored copy could drift.

---

## 4. User Experience & Functionality

### 4.1 Personas

- **Primary:** an analyst at an Indonesian social-media marketing agency reviewing analyzed Reels/Shorts/carousels in the desktop dashboard, comparing engagement across a creator's or competitor's content.

### 4.2 User Stories & Acceptance Criteria

**US-01 — Distinguish hidden counts**
As an analyst, I want a post whose creator disabled counts to say "Hidden" with an explanation, so that I don't misread a deliberate creator choice as zero engagement or missing data.
- [ ] Given a post with `like_and_view_counts_disabled = true`, When I view it on the list/table, a card, or the detail modal, Then the count reads **"Hidden"** with a neutral info icon.
- [ ] Given the "Hidden" info icon, When I hover it, Then a tooltip explains the creator disabled view and like counts on this post.
- [ ] The icon uses neutral/info styling — never warning, error, or alert styling.

**US-02 — Trust a real zero**
As an analyst, I want a genuine zero to read as "0", so that I can trust it as a real measured value.
- [ ] Given a post with a known count of 0 (counts not disabled), When I view any count surface, Then it renders **"0"** and nothing else.

**US-03 — See when data is simply absent**
As an analyst, I want missing data to look different from a real zero, so that I don't treat "we never fetched this" as "this got zero engagement."
- [ ] Given a post with no count value (null/never fetched), When I view any count surface, Then it renders **"—"**.
- [ ] "—" is visually distinct from both "0" and "Hidden".

**US-04 — See real plays when views are a false zero**
As an analyst, I want a Reel that reports 0 views but real plays to show the play number, clearly labelled, so that I see the true reach instead of a misleading 0.
- [ ] Given `view_count = 0 AND play_count > 0`, When I view any count surface, Then the **play count** is displayed, explicitly labelled as **plays** (not views).
- [ ] Given `view_count > 0`, Then the view count is shown as views (Case 4 does not fire).
- [ ] Given `view_count = 0 AND (play_count = 0 or absent)`, Then Case 4 does not fire and the value falls through to Case 2 or Case 3 as appropriate.

**US-05 — Consistency across all surfaces**
As an analyst, I want every place a count appears to behave identically, so that the same post never tells me two different stories.
- [ ] All four states render with their correct treatment on the **list/table**, on **cards**, and in the **detail modal**.
- [ ] No count-displaying surface renders a bare `0` for a hidden, unknown, or false-zero state.

### 4.3 Non-Goals (explicitly out of scope)

- **No backend/schema work** for Cases 2, 3, and 4. Those are pure display derivations over existing columns.
- **No new persisted flag** for Case 4 (owner decision — derive from `view_count`/`play_count`).
- **Not a metrics or analytics redesign.** No new metrics, no trend/history views, no charts, no engagement-rate reformulation.
- **No new tooltip system.** Reuse the ticket #70 tooltip pattern as-is.
- **No copy/behaviour changes** to counts that are already correct today (real non-zero view counts render unchanged).
- **Not** changing how likes vs. views vs. plays are collected or scraped — this is display only.
- **Mobile layout** is out of scope; the product is a desktop dashboard.

---

## 5. Technical Notes (high-level, for the frontend dev)

These are boundaries and hints, not an implementation spec — the tech lead owns the design.

- **State determination is transformation → query-hook layer.** Per `AGENTS.md`, deciding "which of the four states is this count in" is data transformation and belongs in `lib/api/*/hooks.ts` via `select` (e.g. a derived, enumerated `countState` per count). UI components must receive an already-resolved state and only do **presentation** (which icon, which label, tooltip copy, number formatting). Do not branch on raw `view_count`/`play_count`/`like_and_view_counts_disabled` inside components.
- **Shared derivation, one source of truth.** All three surfaces (list/table, cards, detail modal) should consume the same derived state so they cannot drift. A partial fix that leaves one surface showing a bare `0` recreates the bug and fails US-05.
- **Case 4 derivation:** `view_count = 0 AND play_count > 0` → show `play_count` labelled as plays. Both columns are persisted separately (PR #95). Do not collapse them.
- **Tooltip:** reuse the ticket #70 scorecard-rubric tooltip component/pattern for the Case 1 "Hidden" affordance — do not invent a new tooltip.
- **Icon semantics:** Case 1 uses a neutral **info** icon. Explicitly not a warning/error/alert icon.

---

## 6. Dependencies & Risks

- **Dependency (assumed-available): `like_and_view_counts_disabled`.** Case 1 requires this boolean from the backend. It is being persisted right now in **in-flight PR #95 (ticket #71)** — confirmed in that PR's description (field C8 on the ScrapeCreators type, carried through the adapter). This PRD treats it as an assumed-available input. **If PR #95 has not merged when this feature starts, Case 1 cannot be built and QA'd end-to-end** — Cases 2, 3, and 4 are independent of it and can proceed. Coordinate merge order.
- **Risk — partial coverage.** Missing any one surface reintroduces the exact bug. Mitigated by the single-source-of-truth derivation (§5) and the US-05 acceptance criteria.
- **Risk — false-zero label ambiguity.** If "plays" labelling is too subtle, Case 4 could still read as views. Mitigate with an explicit inline label, not just a tooltip.

---

## 7. Open Questions (flagged — not invented answers)

> **CLOSED — owner reviewed 2026-08-05: no further action needed, leave as shipped.** The owner was asked about the five items below and explicitly declined to pursue them. The feature has since shipped and whatever behaviour it shipped with stands. These are kept for the record, not as work items — do not spend time chasing them down. Reopen only if a concrete user complaint appears.

The four states and their treatments are settled. These were flagged as genuinely open at handoff time:

1. **Likes under Case 1.** The Instagram flag disables **like and view** counts together. This PRD's states are described mostly in view/play terms — confirm the **likes** display in each surface also switches to "Hidden" under Case 1 (assumed yes, since the flag covers likes, but state it explicitly). Do likes have their own Case 3 "unknown" ("—") independent of the disabled flag?
2. **Exact tooltip copy (Indonesian vs. English).** App UI is English, analysis output is Indonesian. Confirm the "Hidden" tooltip copy language and exact wording. (Assumed English UI copy, but unconfirmed.)
3. **Carousels and plays.** Case 4 (`view_count = 0 AND play_count > 0`) is a Reel behaviour; per PR #95 carousel children carry `play_count = null`. Confirm no carousel-specific count surface needs different handling, or whether carousels simply fall through to Cases 2/3.
4. **Compact number formatting.** Should large play/view counts be abbreviated (e.g. "116.3K") on cards/table where space is tight, and does that interact with the "plays" label? Presentation detail, not a state decision — flagging for the designer.
5. **"Hidden" on the table's numeric/sortable column.** If any surface sorts or aligns counts as numbers, confirm how "Hidden" / "—" sort and align (non-numeric values in a numeric column). Purely presentational, but needs a call.
