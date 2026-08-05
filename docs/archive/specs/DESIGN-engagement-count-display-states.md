# Design Decision Record — Engagement Count Display States

**Status:** Confirmed by owner, 2026-07-25 — approved for dev handoff
**Author:** Jessica (UI/UX)
**Mockup:** [`docs/archive/specs/engagement-count-display-states-mockup.html`](./engagement-count-display-states-mockup.html) — open in a browser. **Direction A is the shipped treatment**; Direction B is retained only as rejected history (see §4).
**Related:** PRD-engagement-count-display-states.md §3, §4.2, §5 · GitHub #96 (FE), #71/#95 (BE — `like_and_view_counts_disabled`), #70 (FE — tooltip pattern being reused)

This document is the citable record of the display treatment **confirmed** for the four engagement-count states across all three count-bearing surfaces. The mockup HTML is the visual reference; this file is the decision log a developer can cite without opening a browser. The four states and their high-level treatments are **owner-settled in the PRD (§3) and the #96 decision comment**; this doc specifies the *presentation* of those settled states, and all previously-open presentation questions are now resolved (see §4, §8).

---

## 1. Scope and what is already settled

This is a **small display-correctness feature, not a redesign.** The job is: make four genuinely-different count realities look different, consistently, everywhere a count appears. No new metrics, no charts, no layout overhaul.

Settled upstream (do not reopen — recorded here so this doc reads as consistent with them):

- **The four states and their core treatment** (PRD §3): "Hidden" + info icon / "0" / "—" / play-count-labelled-as-plays.
- **Likes get the same "Hidden" treatment as views, and likes get their own "—" unknown state** (#96 decision comment, Q1).
- **Tooltip copy is English** (#96 Q2); exact wording proposed below in §3.
- **Numbers are abbreviated** — "116.3K" (#96 Q4).
- **Non-numeric states sort to the BOTTOM** of a sortable count column (#96 Q5).
- **Reuse the ticket #70 scorecard-rubric tooltip pattern** — do not invent a new tooltip (PRD §5).
- **State determination lives in the query-hook layer** (`select`), not in components (PRD §5, AGENTS.md). This doc is presentation-only; it assumes each count arrives at the component as an already-resolved state + payload.

Also settled and recorded here (formerly open, now resolved — see §8): State 4 is **structurally Reels-only** because Instagram's API never returns a play count for carousel children, and the info-icon color is **info-blue**.

---

## 2. The four states — canonical visual treatment

The same treatment is used on **every** surface (list/table, cards, detail modal) and for **every** metric (views, plays, likes). This is the single source of visual truth; §5 only adapts it to each surface's density.

| # | State | Renders as | Icon | Text color | Key rule |
|---|---|---|---|---|---|
| 1 | Disabled by creator | **"Hidden"** + info icon | circled-`i`, **info-blue** | muted (slate-500) | Info icon is **informational (blue)**, never warning/error/alert. Tooltip on hover **and** focus. Applies to views/plays **and** likes. |
| 2 | Genuine zero | **"0"** | none | full-strength (slate-700+) | Full-strength text — it is trustworthy measured data, must not look de-emphasised. |
| 3 | Unknown / never fetched | **"—"** (em dash `&mdash;`) | none | muted (slate-400) | Visually distinct from both "0" and "Hidden". No icon, no tooltip required. |
| 4 | Views 0, plays exist | **abbreviated play count + "plays" label** | none | full-strength | Never render the false "0 views". The word **plays** is mandatory and inline, not tooltip-only (PRD §6 risk). |

### Why these specific choices

- **Info-blue info icon (circled lowercase `i`), not a warning triangle / alert.** State 1 is a creator's deliberate privacy setting. Nothing is broken. A warning/error glyph would tell the analyst "something failed here" — actively wrong, and it is the exact misread the PRD is trying to kill. The icon is rendered in **info-blue** (owner-confirmed), the conventional "here's some context" signal — never alert-red or amber. This is safe against the app's existing color grammar: I checked `app/app/analyses/` and red / `text-destructive` / `AlertTriangleIcon` / `AlertCircle` mean error/danger, while yellow-amber (`text-yellow-*`) means warning/pending. **Blue is not used for any status state in that surface**, so an info-blue icon cannot be confused with an existing error or warning treatment. (Note: the reused #70 tooltip trigger in `DimensionScoreRow` uses `text-muted-foreground` for its "why?" `InfoIcon`; we deliberately go one step more prominent here — a standalone info affordance the analyst must notice, not an inline "why?" link — so the blue tint is the intended, owner-picked divergence, still firmly in non-alert territory.)
- **Em dash for unknown, muted; "0" at full strength.** The whole point is separation. If "0" were also muted it would blur into "—". So: "0" is confident, dark, real; "—" is quiet, grey, absent. Different weight *and* different glyph — two channels, not one.
- **"plays" is an inline word, never only a tooltip.** PRD §6 explicitly warns that a too-subtle plays cue re-creates the bug (analyst reads a plays number as views). So the label is always visible text next to the number. The two directions in §4 differ only in *how loud* that label is.
- **More than color alone (WCAG 1.4.1).** Every state is separated by text and/or icon and/or glyph, not hue: "Hidden" (word+icon) vs "0" (digit) vs "—" (dash) vs "116.3K plays" (number+word). A greyscale screenshot still disambiguates all four.

---

## 3. Proposed tooltip copy (English — owner to confirm exact wording)

The "Hidden" info icon exposes one short string. Proposed primary:

> **"The creator turned off view and like counts on this post. This is a creator setting — not zero, and not missing data."**

Rationale: it names *who* did it (the creator), *what* it covers (view **and** like counts — matters because likes also switch to "Hidden" per #96 Q1), and — most importantly — explicitly rules out the two misreads this whole feature exists to prevent ("not zero, and not missing data"). Same string on views and likes; no need to vary it per metric.

Shorter fallback if the above feels long in a small tooltip:

> **"The creator disabled view and like counts on this post — not zero or missing data."**

Owner picks the wording; both are English per the settled decision.

---

## 4. State 4 "plays" label — CONFIRMED Direction A everywhere

The one genuine latitude in this feature was **how explicitly the State 4 "plays" label is drawn**. That question is now **settled: Direction A — the quiet inline label — ships on every surface** (list/table, cards, and detail modal). This is not a hybrid or an A-here/B-there split; it is pure Direction A, consistently. Direction B is **rejected** and is documented below only as history.

### Direction A — Quiet inline label — **CONFIRMED, ships everywhere**
`116.3K` followed by a small, muted lowercase **"plays"** suffix (e.g. `116.3K plays` as understated inline text).
- Pro: calm, reads naturally, matches the existing "482K views" phrasing already in the sidebar. One treatment across all three surfaces — nothing to branch on, simpler to build and to reason about.
- The PRD §6 "plays reads as views" risk is mitigated by the label being **always-visible real text** (never tooltip-only) and by the number sitting in a cell that no longer claims to be a bare view count. The owner judged the quiet suffix sufficient; the louder chip (Direction B) was deemed more chrome than a false-zero correction warrants.

### Direction B — Explicit "plays" tag — **REJECTED (history only)**
`116.3K` followed by a small **PLAYS** pill/tag (uppercase, amber-tinted chip). Considered as the strongest possible mitigation of the PRD §6 risk, but **not chosen**: a colored chip in an otherwise plain numeric column draws the eye more than the correction warrants, and the amber tint sits uncomfortably close to the app's warning color grammar (`text-yellow-*` = pending/warning in `app/app/analyses/`). Retained in the mockup's toggle, clearly marked as rejected, so the trade-off considered here stays visible to anyone revisiting this decision. **Do not build Direction B.**

---

## 5. Surface-by-surface application

Same four treatments; only density and layout change.

### 5.1 List / table
```
CONTENT                         TYPE       VIEWS ▼        LIKES
Nasi Goreng Kampung 5 Menit     Reel        482.1K       31.4K
Tutorial Sambal Matah           Reel   116.3K plays *      4.8K     <- State 4
Behind the Scenes Dapur         Reel             0           0      <- State 2 (real zero)
------------------------------------------- sort boundary -------------
Kolaborasi Brand X              Reel      Hidden (i)   Hidden (i)   <- State 1
Draft Carousel                  Carousel         —           —      <- State 3
```
- Count columns are **right-aligned** (numeric convention). "Hidden" and "—" stay right-aligned *in column* — they do not jump to left/center. The info icon sits immediately after the word "Hidden", so the unit hugs the right edge as `Hidden (i)`.
- **Sort:** when a count column is sorted, numeric rows (States 2 & 4) sort by their numeric value; **non-numeric states (States 1 & 3) always sink to the bottom**, regardless of ascending/descending (#96 Q5). Among themselves, "Hidden" and "—" ordering is unspecified/stable — not worth a rule.
- State 4 sorts by its **play_count** value (it is a real number occupying the views cell).

### 5.2 Cards
- Counts sit in the card's metric row with the existing metric glyphs (👁 views/plays, ❤️ likes).
- Compact: State 4 shows `👁 116.3K plays`, State 1 shows `👁 Hidden (i)` with the icon still focusable, State 3 shows `👁 —`, State 2 shows `👁 0`.
- The tooltip on cards opens from the icon on hover/focus exactly as elsewhere; positioning flips to open below/right if the card is near the viewport top.

### 5.3 Detail modal (sidebar meta block)
- Counts live in the modal's left meta sidebar — the same slot that today reads "482K views · 3 Jul 2026".
- Most vertical room here, so counts can stack on their own lines with full metric words: `👁 116.3K plays`, `❤️ 4.8K likes`, `👁 0 views`, `👁 — views`, `👁 Hidden (i)`.
- Direction A's quiet suffix (the confirmed treatment, §4) is especially comfortable here, where the count sits on its own line with room and no mislabelling header to fight.

---

## 6. Interaction & state rules

- **Info icon (State 1) trigger:** focusable (`tabindex="0"`, `role="button"`), shows the tooltip on **hover and keyboard focus**, dismissible on blur / mouse-out / `Escape`. This mirrors the #70 scorecard-rubric tooltip interaction exactly — reuse that component, do not build a new one.
- **Tooltip positioning:** default above-and-right of the icon; flip to below or left when near a viewport/container edge (top rows of the table, top of a card).
- **No interaction on States 2, 3, 4** — they are static text. "—" carries no tooltip (kept deliberately quiet; if a "never fetched" explanation is ever wanted it can be added later, but it is out of scope now).
- **Hover on plays (State 4):** none required. The label is always-visible text; a tooltip would be redundant.

---

## 7. Accessibility notes (carried into implementation)

- **WCAG 1.4.1 (color is not the only channel):** satisfied by construction — each state differs by text/glyph/icon, not hue. Verify in greyscale.
- **Tooltip a11y (reuse #70 pattern):** the info-icon trigger must be reachable and dismissible by keyboard, `aria-describedby` pointing at the tooltip element with `role="tooltip"`, tooltip content exposed to screen readers — **not** a bare native `title` attribute (native `title` is not reliably keyboard/SR reachable; #70's own a11y note calls this out).
- **Accessible name for "Hidden":** the icon's accessible label should read as a question/context ("Why is the view count hidden?" / "Why is the like count hidden?") so a screen-reader user understands the trigger's purpose before opening it; the full explanation lives in the described-by tooltip.
- **Contrast:** muted states ("—" slate-400, "Hidden" slate-500) must still meet 4.5:1 against the surface background — nudge darker if a chosen palette value fails. The info-icon border/glyph must meet 3:1 (non-text/UI-component contrast, WCAG 1.4.11).
- **Info-icon color contrast:** the info-blue icon border/glyph must meet 3:1 against the surface background (WCAG 1.4.11, non-text UI component). Blue is a redundant channel only — the word "Hidden" plus the circled-`i` shape already carry the meaning, so a greyscale reader loses nothing.
- **Screen-reader reading of State 4:** ensure it announces as "116.3K plays", not "116.3K" then a visually-detached label — keep the number and the word "plays" in the same accessible phrase. (Direction A ships, so "plays" is plain muted inline text; there is no chip to detach.)

---

## 8. Resolved decisions (formerly open — now settled)

**Carousels and State 4 — SETTLED: State 4 is Reels-only.** This is not a product preference or an assumption; it is a structural fact of the data. Instagram's API **never returns a play count for carousel children** — `video_play_count` comes back `null` (not `0`) on every captured carousel child, so there is literally nothing to fall back to for a carousel. Reels, by contrast, reliably carry a real play count even when `view_count` is 0. Therefore:

- **State 4 (real play count, labelled "plays") is structurally Reels-only.**
- A carousel with `view_count = 0` can only fall through to **State 2 ("0")** — a genuine measured zero — or **State 3 ("—")** — never fetched / unknown. It can never reach State 4, because no play-count value exists to show.
- No separate "carousel plays" treatment is needed or possible; the question of "what other count should a carousel surface instead" is moot — there isn't one.

This closes the former #96 Q3 open question. The mockup's carousel rows reflect this settled behaviour (they show "—" / "0", never a "plays" label) with no outstanding decision callout.

**Info-icon color — SETTLED: info-blue.** Owner-confirmed (see §2). Chosen over neutral slate. Verified safe against the app's existing color grammar in `app/app/analyses/`: red/`destructive`/`AlertTriangle` = error, amber/`yellow` = warning/pending, and **blue is unused for status** — so the info-blue icon reads unambiguously as informational, with no collision against any existing alert or warning styling.

---

## 9. Sign-off record

- **Owner decision: CONFIRMED, 2026-07-25.** This doc is approved and ready for tech-lead / dev handoff. All previously-open questions are resolved.
- **State 4 label:** **Direction A — quiet inline "plays" suffix — ships on all three surfaces** (list/table, cards, detail modal). Not a hybrid. Direction B (amber "PLAYS" chip) is **rejected**, retained in the mockup toggle as history only (see §4).
- **Carousels:** **State 4 is Reels-only** — structural, not a preference: Instagram returns `video_play_count = null` for carousel children, so no play count exists to show (see §8).
- **Info-icon color:** **info-blue** — owner-confirmed, verified non-conflicting with the app's error(red)/warning(amber) color grammar (see §2, §8).
- Mockup `docs/archive/specs/engagement-count-display-states-mockup.html` updated to match: Direction B toggle labelled rejected, carousel rows show the settled Reels-only behaviour with no open-question callout, info icon rendered in info-blue.
