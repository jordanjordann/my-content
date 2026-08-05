# Design Decision Record — Analysis Detail: Tier 1 Style Section

**Status:** Confirmed by owner, 2026-07-22
**Author:** Jessica (UI/UX)
**Mockup:** [`docs/design/analysis-tier1-style-mockup.html`](./analysis-tier1-style-mockup.html) — open in a browser, toggle "Direction A" / "Direction B" at the top
**Related:** PRD-analysis-schema-redesign.md §4.2, §4.3, §4.6, §8, §13 · TDD-analysis-schema-redesign.md §8.2 · GitHub #69 (BE), #70 (FE)

This document is the citable record of what was decided for the Analysis Detail modal's Tier 1 style section and its relationship to the Tier 2 scorecard. The mockup HTML is the visual reference; this file is the decision log a developer can cite without opening a browser.

---

## 1. Confirmed: Direction A — tabbed modal

The modal is organized into three tabs: **Gaya** (style) · **Skor AI** (scorecard) · **Catatan** (notes — strengths/weaknesses/red flags/suggestions). **Gaya is the default landing tab**, consistent with PRD §3's confirmation that style is the primary purpose of analysis and scoring is secondary (§13: "Style is the primary purpose of analysis output; performance scoring is secondary").

This is the owner's call, made against my recommendation. I had proposed Direction B (single scrollable panel, style section given hero treatment at the top, scorecard immediately below it, notes collapsed under a `<details>`), on the reasoning that tabs hide the scorecard behind a click and add a small amount of state management for no real content-density gain in a modal of this size. The owner's reasoning, relayed from the boss: **Direction A is the right trade if agency users will often want the scorecard in isolation** — skimming quality scores across many videos in bulk without wading through style attributes each time. That's a plausible workflow for someone auditing a creator's whole output, and it's the workflow tabs serve well that a single scroll doesn't. Recording this so the trade-off is visible to whoever revisits this later: Direction A costs one extra click to reach style detail on first open and a small amount of tab state in the component; Direction B optimizes single-video read-through at the cost of forcing a scroll past style content when only the score is wanted. The owner judged the bulk-scanning use case worth that cost. The scorecard is one click away in either direction — the practical gap is smaller than it sounds.

Developer note: tab state is local UI state (`useState`), not URL or query state — no deep-linking requirement was raised.

---

## 2. Confirmed design decisions (part of the accepted direction)

These apply within Direction A and are not independently up for debate — they were part of the same proposal the owner approved.

### 2.1 Five-pip meter (replaces radial gauge)
Every score (overall and per-dimension) renders as five small squares ("pips"), filled left-to-right to the score value, plus a plain-language band word from the rubric (e.g. "4/5 · Strong"). This replaces the percentage-style radial ring used for the old 1–10 scorecard.

Why: a battery/step meter reads as discrete steps on a 5-point scale, matching the data. A radial gauge implies smooth, continuous, precise measurement — the wrong visual grammar for a 5-point AI judgement call, and it's what produced the original "5/10 half-full ring" bug this whole redesign is fixing (see TDD #70 breakage list). The band word (Strong/Adequate/Weak/etc.) is pulled from the same rubric that defines the score, so the visual and the text never disagree.

### 2.2 Rubric-band tooltip per dimension
Hovering (or tapping, on touch) a dimension score surfaces the actual rubric sentence for *that specific score value* — e.g. a `4` on `hookStrength` shows "Hook menyebutkan manfaat konkret dalam 2 detik pertama dan memicu rasa penasaran ringan," not a generic definition of the dimension.

This is the **primary mechanism for conveying "AI judgement, not measurement."** A bare number invites the user to trust it as precise; a specific, checkable rubric sentence turns it into a claim the user can verify against the video in front of them. This does more work than a disclaimer banner alone — treat it as load-bearing for the product's honesty about what the score means, not a nice-to-have tooltip.

In the mockup this is a `title` attribute for speed of prototyping; production should use a proper accessible tooltip/popover component (see §4, a11y notes) since native `title` is not reliably reachable by keyboard or screen reader.

### 2.3 Single "Penilaian AI" strip
One disclaimer strip ("Penilaian AI — bacaan model atas video ini, bukan pengukuran presisi. Gunakan sebagai satu sinyal, bukan fakta mutlak.") sits once at the top of the Skor AI tab. It is not repeated per score row — the rubric tooltip (§2.2) carries the per-score honesty burden; the strip only needs to set the frame once.

### 2.4 Bilingual enum rendering
Every enum value renders with the Indonesian label as the primary, bold text, and the English machine identifier always visible beneath it in small muted monospace — **not hover-only**. E.g. "Janji Manfaat Langsung" / `DIRECT_VALUE_PROMISE`.

Always-visible (not hover-gated) because the identifier is used for cross-referencing exports and for talking to engineering about a specific taxonomy value — that's a real, recurring use case for this audience, not an edge case worth hiding behind a hover state.

### 2.5 `ctaType[]` as equal-weight chips
`ctaType` is an array (PRD §4.4: "structural change — `ctaType` is an ARRAY, not a single enum value"); render all values as same-size chips with no ordering implication (no "primary/secondary" visual hierarchy, no numbering). This matches the PRD's explicit order-insignificant rule for this field.

### 2.6 `hookTypeSecondary` as visibly subordinate
Where present, the secondary hook type renders smaller and after a "+ juga:" connector, clearly subordinate to the primary hook type chip — not a same-size second chip beside it. `hookType`/`hookTypeSecondary` is a real primary/optional-secondary relationship (PRD §4.3.4), unlike `ctaType[]`'s flat array — the visual treatment should match: real hierarchy here, false parity would misrepresent the data.

### 2.7 Fingerprint hint line
A single line in the sidebar: "Bagian dari gaya @username — butuh 5+ analisis" (English: "Part of @username's style — needs 5+ analyses"). Uses data already available from PRD §6 (style fingerprint requires an analysis-count threshold before it's considered reliable). Sets the expectation up front that a single analysis is one data point feeding a fingerprint, not a fingerprint itself — this prevents the user from over-reading one video's style attributes as "this creator's style."

### 2.8 Structure beat map as horizontal timeline
`structureBeatMap` renders as a horizontal timeline with a dot per beat (Hook / Setup / Body / Resolution / CTA in the sample), each hoverable for its timestamp and detail sentence, plus a tempo readout ("Cepat · ~22 potongan/menit") pulling in `pacing` and `estimatedCutsPerMinute`. This is the one Tier 1 field that is inherently temporal/sequential — a flat bulleted list would discard the "when in the video" information that's the actual point of capturing beats.

### 2.9 Style section placed above the scorecard (resolves TDD §8.2)
Within the Gaya tab (and as the default landing tab overall), style content is presented before/above scorecard content. TDD §8.2 flagged Tier 1 placement relative to the scorecard as a deferred design question ("No design exists for what is now the product's headline output... placement of the style section relative to the scorecard in the modal is a design call, not the developer's" — TDD §8.2, echoed in #70's "Design gap" note). This decision resolves that: style leads, consistent with PRD §3's ranking of style as primary purpose and scoring as secondary. Under Direction A this materializes as tab order (Gaya first, leftmost, default-active) rather than vertical position, but the intent — style is what the user sees first — is the same resolution either direction would have given.

---

## 3. What still needs detailing at implementation time

Flagging these as gaps the mockup illustrates but does not fully specify — a developer will need to make or confirm small calls here, and one needs an owner decision:

- **Rubric tooltip component.** The mockup uses `title=""` for speed. Production needs a real accessible tooltip/popover (keyboard-focusable trigger, `role="tooltip"` or a disclosure pattern) — see a11y notes below. This is a component decision, not a design decision, but flagging so it isn't accidentally shipped as a native title attribute.
- **Empty/partial-data states not mockup'd.** The mockup uses one fully-populated sample analysis (`@rasa.dapur.id`). Nullable fields (`hookTypeSecondary` absent, `onScreenText` empty, `structureBeatMap` with fewer beats) don't have an explicit "what renders when absent" treatment yet. Recommend: omit the row/chip cleanly rather than showing an empty state per field — but this wasn't tested in the mockup and is worth a quick sanity check against a real sparse analysis once #69 is live.
- **Mobile/narrow-viewport behavior.** The mockup is designed and reviewed at desktop width only (the modal's fixed sidebar + content layout). No responsive breakpoint behavior was specified. Flagging as out of scope for this decision — needs a call on whether this product surface needs mobile support at all before investing design time.
- **Legacy (pre-v2) analysis rows.** Ticket #69 raises the question of whether the 2 existing pre-redesign `analyses` rows are deleted or kept and branched on by `schemaVersion`. That's a data/product decision for #69, not a design one, but if the owner chooses to keep them, this style section (which assumes v2 fields exist) will need an explicit "no style data available — analysis predates this feature" fallback state that has not been designed. **Owner call still needed if legacy rows are kept.**

---

## 4. Accessibility notes (carried into implementation)

- Tab controls (Gaya / Skor AI / Catatan) must be a proper ARIA tab pattern: `role="tablist"`/`role="tab"`/`role="tabpanel"`, `aria-selected`, arrow-key navigation between tabs, and focus management on activation.
- Rubric-band info triggers (§2.2) must be reachable and dismissible by keyboard, not mouse-hover-only — use a focus-triggered popover/disclosure, with the rubric sentence exposed to screen readers (not merely a `title` attribute).
- Pip meters need a text equivalent already present in the DOM (the "4/5 · Strong" label satisfies this) rather than relying on fill color alone — this also covers colorblind users, since pip fill state should not be conveyed by color alone if band word/count isn't adjacent.
- Bilingual enum rendering (§2.4): the monospace English identifier is decorative/supplementary; ensure the accessible name for the control is the Indonesian label, with the identifier available in the accessible description if it needs to be exposed to assistive tech at all.
- Standard modal a11y applies (focus trap, `Escape` to close, initial focus on open) — not new to this decision, restating since this doc may be the first thing a developer reads before touching `AnalysisDetailModal.tsx`.

---

## 5. Tickets affected

- **#70 (FE)** — implements this design. `AnalysisStyleSection` (new module, full structure per AGENTS.md), `AnalysisScorecardSection` (pip meter + rubric tooltips replace radial gauge), `AnalysisDetailModal` (tab shell). #70's own ticket text already flags the design gap this document resolves.
- **#69 (BE)** — no design dependency, but **#69 and #70 must merge and deploy in the same batch** (per #70: "Any window in which #69 has merged and this has not is a visibly broken app," due to the 1–5 rescale breaking the old `/10` rendering). Noting here only so this document doesn't read as if it changes that sequencing requirement — it doesn't.

---

## 6. Sign-off record

- Two directions presented in `docs/design/analysis-tier1-style-mockup.html`.
- Designer recommendation: Direction B.
- Owner decision: **Direction A**, per rationale in §1 (attributed to the boss).
- All sub-decisions in §2 are part of the approved proposal, not independently re-litigated.
