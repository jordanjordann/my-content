# Design Decision Record — Engagement Count Display States

**Status:** Proposed — awaiting owner review (NOT yet approved for dev)
**Author:** Jessica (UI/UX)
**Mockup:** [`docs/design/engagement-count-display-states-mockup.html`](./engagement-count-display-states-mockup.html) — open in a browser, toggle "Direction A" / "Direction B" at the top
**Related:** PRD-engagement-count-display-states.md §3, §4.2, §5 · GitHub #96 (FE), #71/#95 (BE — `like_and_view_counts_disabled`), #70 (FE — tooltip pattern being reused)

This document is the citable record of the display treatment proposed for the four engagement-count states across all three count-bearing surfaces. The mockup HTML is the visual reference; this file is the decision log a developer can cite without opening a browser. The four states and their high-level treatments are **owner-settled in the PRD (§3) and the #96 decision comment** — this doc specifies the *presentation* of those settled states, not the states themselves.

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

Still open (flagged, NOT answered here): carousel children (`play_count = null`) and whether State 4 is Reels-only — see §8.

---

## 2. The four states — canonical visual treatment

The same treatment is used on **every** surface (list/table, cards, detail modal) and for **every** metric (views, plays, likes). This is the single source of visual truth; §5 only adapts it to each surface's density.

| # | State | Renders as | Icon | Text color | Key rule |
|---|---|---|---|---|---|
| 1 | Disabled by creator | **"Hidden"** + neutral info icon | circled-`i`, slate/muted | muted (slate-500) | Info icon is **neutral**, never warning/error/alert. Tooltip on hover **and** focus. Applies to views/plays **and** likes. |
| 2 | Genuine zero | **"0"** | none | full-strength (slate-700+) | Full-strength text — it is trustworthy measured data, must not look de-emphasised. |
| 3 | Unknown / never fetched | **"—"** (em dash `&mdash;`) | none | muted (slate-400) | Visually distinct from both "0" and "Hidden". No icon, no tooltip required. |
| 4 | Views 0, plays exist | **abbreviated play count + "plays" label** | none | full-strength | Never render the false "0 views". The word **plays** is mandatory and inline, not tooltip-only (PRD §6 risk). |

### Why these specific choices

- **Neutral info icon (circled lowercase `i`), not a warning triangle / alert.** State 1 is a creator's deliberate privacy setting. Nothing is broken. A warning/error glyph would tell the analyst "something failed here" — actively wrong, and it is the exact misread the PRD is trying to kill. The icon is rendered in a muted slate, not alert-red or amber. (Info-blue would also be acceptable and conventional; I chose neutral slate to stay maximally clear of any "status" reading. Owner may prefer info-blue — easy swap, flagged as a small choice.)
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

## 4. Two directions — the only real design choice here (§4 differs, §2/§3/§5 do not)

Everything above is fixed by the settled decisions. The one genuine latitude is **how explicitly the State 4 "plays" label is drawn** — the PRD flags subtlety as a risk, so this is worth an owner call. Both directions are in the mockup behind the top toggle.

### Direction A — Quiet inline label (mockup default)
`116.3K` followed by a small, muted lowercase **"plays"** suffix.
- Pro: calm, reads naturally, matches the existing "482K views" phrasing already in the sidebar.
- Con: in a tight right-aligned table cell under a "Views" header, a muted suffix can be skimmed past — the exact subtlety PRD §6 warns about.

### Direction B — Explicit "plays" tag
`116.3K` followed by a small **PLAYS** pill/tag (uppercase, amber-tinted chip).
- Pro: unmissable; makes "this is NOT a view count" impossible to skim past. Strongest mitigation of the PRD §6 risk.
- Con: slightly louder / more chrome; a colored chip in an otherwise plain numeric column draws the eye more than a false-zero correction arguably warrants.

**Designer recommendation: Direction B for the list/table and cards** (where the "Views" column header actively fights the value and space-pressure invites skimming), and Direction A's quiet suffix is fine in the **detail modal** (where the count sits on its own line with room and less risk of a header mislabel). I.e. a hybrid is on the table if the owner wants it — but a single consistent direction across all three surfaces is also perfectly acceptable and simpler to build. **Owner's call.**

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
- This is where Direction A's quiet suffix reads best (§4).

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
- **"plays" tag (Direction B):** the amber chip's text must meet 4.5:1 on its fill; the chip must not be the *only* signal — the word "plays" is real text, which satisfies this. Do not encode "plays vs views" in chip color alone.
- **Screen-reader reading of State 4:** ensure it announces as "116.3K plays", not "116.3K" then a visually-detached chip — keep the number and the word "plays" in the same accessible phrase.

---

## 8. Open question for owner (NOT answered here)

**Carousels and State 4.** Carousel children carry `play_count = null` (per PR #95). Is State 4 (plays-shown-instead-of-views) **Reels-only**, with carousels simply falling through to State 2 ("0") or State 3 ("—")? The mockup **assumes yes** — carousels never render a "plays" label (see the "Draft Carousel" rows, which show "—"). This is a visible assumption in the prototype, **not a settled decision** (#96 Q3 is explicitly still open). If the owner decides carousels should surface some other count instead, the treatment for that case is undesigned and needs a follow-up. **Owner decision needed before build.**

Small secondary choice, easy to settle in review: **info-icon color** — neutral slate (mockup default) vs conventional info-blue. Both read as non-alert; picking one is a one-line change.

---

## 9. Sign-off record

- Two directions presented in `docs/design/engagement-count-display-states-mockup.html` (toggle at top). They differ **only** in State 4's "plays" label loudness; all other treatments are identical and fixed by settled decisions.
- Designer recommendation: **Direction B** on table/cards (strongest mitigation of the PRD §6 "plays reads as views" risk), Direction A acceptable in the modal — or a single consistent direction across all three if the owner prefers simplicity.
- Owner decision: **PENDING.** This doc is proposed, not approved. No developer sign-off yet — owner review first.
