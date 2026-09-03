# Design Spec — Responsive Sidebar & Table (Issue #284) — Revision 2

**Status: PROPOSED — pending owner sign-off. Do not build against this until approved.**

Source: [GitHub #284](https://github.com/jordanjordann/my-content/issues/284) (Audit finding F-13, P1)
Designer: Jessica
Mockup: `docs/design/284-responsive-sidebar-mockup.html` (open in a browser — resize buttons, content-state buttons, and the rail toggle are all live)

This is **Revision 2**. Revision 1 (hamburger + binary overlay drawer) was approved as the baseline and is preserved in spirit below, but §6–§7 are rewritten: the drawer is replaced with a **two-state rail** (compact / expanded) per the owner's new request. Everything not touched by that request (breakpoint, table treatment, empty-state fix) carries over unchanged from Revision 1.

---

## 1. Problem recap (unchanged from Rev 1)

`Sidebar.tsx` renders a fixed `w-64` (256px) `<aside>` and gates main content with `pl-64`, with no responsive variant. Below desktop width this eats most of the screen:

| Viewport | Sidebar | Horizontal overflow | Real-world effect |
|---|---|---|---|
| 375×812 (phone) | 256px = 68% of screen | 481px | Table crushed to ~120px, density buttons overflow |
| 768×1024 (tablet, with data) | 256px | 795px | Same crushing |
| 1440 / 1920 | 256px | none | Clean |

Screenshots reviewed: `08-mobile-375-analyses.png`, `22-tablet-768.png`, `09-responsive-mobile-375-EMPTY.png`.

## 2. Owner decisions — SETTLED

These are locked in. Not presented as open questions below.

1. **Breakpoint: `lg:` (1024px).** Below it, sidebar is not persistent. At/above it, sidebar is the full 256px panel exactly as today — **zero visual change ≥1024px.**
2. **Sticky first column in the horizontal-scroll table (640–1023px): in scope now.** Designed in §8.
3. **The rail does NOT auto-close/auto-collapse when a nav link is tapped.** Tapping a link while expanded keeps it expanded (see state machine, §6).
4. **Mobile and tablet are supported surfaces.** No wontfix path.

## 3. What changed since Rev 1 — the compact/expanded rail

Rev 1 proposed a binary drawer: hidden by default, hamburger opens it as a full overlay, closes to nothing. Decision 3 above makes that model awkward — if the drawer stays open after every nav tap, a user browsing several analyses in a row is stuck with a permanent scrim over their content, or has to manually dismiss it every time.

The owner's fix: don't make "open" and "closed" the only two states. Give the rail a resting **compact** state that stays visible (icon rail) instead of disappearing, and an **expanded** state the user opens deliberately to see labels. This section replaces Rev 1 §5–§7 in full.

### 3.1 What "compact" is

- **Width: 64px** (`w-16`). This is a Tailwind-clean value and matches the number the owner's brief used when framing the screen-real-estate tradeoff (see §7 for that tradeoff, discussed honestly, not hand-waved).
- **Content:** brand mark only (36×36 icon, wordmark dropped — no room), then nav items as icon-only buttons, each a 44×44 tap target centered in the 64px rail.
- **Labels do not truncate. They vanish entirely.** A truncated single letter ("A" for "Analyses") tells the user nothing and is worse than no label — it looks broken, not compact. Full label or no label, never partial.
- **Active/selected item with no text:** relies on three redundant, non-color-only cues so it doesn't fail colorblind users:
  1. Filled/solid icon variant for active vs. outline variant for inactive (shape difference, not just color).
  2. Accent color (orange, matching today's active-row accent) on the icon.
  3. A 3px accent-colored bar on the left edge of the active icon's tap target.
- **How the user knows what an icon means, solved for touch first:** hover tooltips don't exist on touch, so I'm not relying on them as the primary mechanism. The actual answer is: **make expanding trivially cheap.** The toggle that reveals labels is the first thing in the rail (see §3.2), always one tap away, and every icon still carries a real `aria-label` for screen reader users regardless of expand state. Icon choice itself should also be conventional (bar-chart glyph for "Analyses", not something invented). A long-press-to-preview-label pattern was considered and **rejected** — poor discoverability, no established convention on mobile web, adds a gesture nobody will find without being told.

### 3.2 How the user expands and collapses it

- **Affordance:** a dedicated toggle button, always the **first item in the rail**, above the nav links — not the brand mark, not folded into a nav item. Chevron glyph: `»` when compact (expand), `«` when expanded (collapse). Same button, same position, in both states, so the user never has to relearn where it lives.
- **This replaces the header-row hamburger from Rev 1.** The toggle now lives in the rail itself, not the page-header row. Side benefit: it removes one element from the `[hamburger][title][New Analysis]` contention Rev 1 flagged as a P3 risk on the narrowest phones — the header row is now just `[title][New Analysis]`.
- **Other ways to collapse (expanded → compact):** tap the scrim, `Esc` key, or the toggle itself. All three return focus to the toggle button.
- **Persistence:**
  - **Across in-app navigation (SPA route changes):** expanded stays expanded, per decision 3. Tapping "Analyses" while expanded navigates and the rail stays open.
  - **Across a hard page reload:** resets to compact. Reasoning: an overlay + scrim appearing unprompted on first paint, before the user has done anything, reads as broken, not helpful — nobody asked for it to open. Session-only persistence (in-memory or `sessionStorage`, not `localStorage`) gets the "stays open while I'm browsing" behavior the owner wants without a scrim ambushing a fresh page load. **This is my reasoned default, not a hard requirement — flagging it clearly in case the owner wants full persistence across reloads instead.**
  - **Across a viewport resize crossing the `lg` boundary:** always resets to compact when re-entering the <1024 range (e.g., rotating a tablet, or resizing a browser window down from desktop). Prevents a stale full-width overlay reappearing on a screen size it wasn't designed for.

### 3.3 How compact/expanded reconciles with open/closed — the state machine

**There is no separate "closed" state anymore below `lg`. Compact replaces closed.** The rail is always visible below `lg` — it just changes width and overlay behavior. This is the reconciliation: instead of two independent axes (open/closed × compact/expanded, which would in fact be 4 states, one of them nonsensical — a "closed but expanded" rail is meaningless), there is **one axis with two states**, scoped per breakpoint bucket:

```
                         ┌─────────────────────────────────────┐
                         │            viewport < lg              │
                         │                                        │
        ┌────────────┐  tap toggle   ┌─────────────┐            │
        │  COMPACT    │ ────────────▶│  EXPANDED    │            │
        │  (default,  │               │  (overlay,   │            │
        │  64px rail, │◀────────────  │  256px,      │            │
        │  pushes     │  tap toggle   │  scrim,      │            │
        │  content)   │  tap scrim    │  role=dialog)│            │
        └─────┬───────┘  Esc          └──────┬───────┘            │
              │                                │ tap nav link      │
              │ tap nav link                   │ (per decision 3:  │
              │ (navigates,                    │  stays EXPANDED,  │
              │  stays COMPACT)                │  navigates)       │
              │                                │                   │
              └──────────────┬─────────────────┘                   │
                              │ hard page reload  →  resets to COMPACT
                              │ resize crosses lg →  resets to COMPACT
                         └─────────────────────────────────────┘

                         ┌─────────────────────────────────────┐
                         │            viewport ≥ lg              │
                         │                                        │
                         │   PERSISTENT (256px, static,          │
                         │   no toggle rendered, no compact       │
                         │   concept — identical to today)        │
                         │                                        │
                         └─────────────────────────────────────┘
```

Two states below `lg` (COMPACT, EXPANDED), one state at/above `lg` (PERSISTENT, unchanged from today). No four-state matrix, no dead combinations.

### 3.4 Overlay vs. push

- **COMPACT pushes.** The 64px rail reserves real layout space; `main` gets `padding-left: 64px` (`pl-16`). This is a deliberate, permanent tax on content width below `lg`, discussed honestly in §7.
- **EXPANDED overlays.** Going from 64px to 256px by *pushing* on a 375px screen would leave 119px for content — not viable. So expanding is always an overlay: `main`'s padding stays at the COMPACT value (64px), the rail becomes `position: fixed` at 256px width on top of everything, with a scrim over the remaining content. Content underneath keeps its compact-width layout; it's just covered.
- **This is intentionally the same overlay behavior at both 375px and 768px.** At 768, 768−256=512px would technically be enough to push instead of overlay — but introducing a third breakpoint-specific behavior (push at tablet, overlay at phone) adds a state-machine branch for a marginal gain. One model per breakpoint bucket, consistently applied. Flagging this simplification explicitly — happy to revisit if the owner wants tablet to push.

## 4. Information architecture (updated)

**Persistent, all viewports**
- Brand mark
- Nav: "Analyses" (today's only item; icon-only in COMPACT, icon+label in EXPANDED/PERSISTENT)
- Page title + "New Analysis" action
- Filter row, table toolbar, table/cards, pagination

**< `lg` only**
- Rail expand/collapse toggle (top of rail, replaces Rev 1's header hamburger)
- Scrim (EXPANDED only)

Header row simplifies to `[title, grows] [New Analysis]` — no hamburger competing for space anymore.

## 5. The breakpoint (unchanged from Rev 1, now settled)

`lg:` (1024px). Below it: rail (compact/expanded). At/above it: persistent 256px sidebar, identical to today. Rationale carried forward: the ticket's own correction showed 768px breaks with real data (795px overflow), so gating at `md:` would just move the bug 1px to the right.

## 6. Rail component states — detail

| State | Width | Position | Content pushed? | Scrim? | Modal semantics? |
|---|---|---|---|---|---|
| COMPACT | 64px | static (in flow) | Yes, `main` has `pl-16` | No | No — plain `<nav>` landmark, background fully interactive |
| EXPANDED | 256px | `fixed`, overlay | No (stays at compact's 64px reservation) | Yes, 60% black | Yes — `role="dialog" aria-modal="true"` while open, background `inert` |
| PERSISTENT (≥`lg`) | 256px | static | Yes, `main` has `pl-64` | No | No |

## 7. The screen-real-estate tradeoff — addressed directly

At 375px, a 64px compact rail is **17% of the screen**, permanently. That's a real cost, and worth naming plainly rather than glossing over: Rev 1's model had *zero* permanent footprint below `lg` (fully hidden, nothing reserved) versus this model's *always-visible* 64px. The tradeoff exists because the owner explicitly asked for "a narrow icon-only strip that stays visible" rather than a binary open/closed panel — persistent wayfinding, at the cost of ~64px of content width on every screen below `lg`.

**My assessment: acceptable, with one condition.** 64px is small relative to the 256px it replaces (75% width recovered vs. today's broken state), and persistent nav visibility is a real usability gain once the nav grows past one item — a user won't need to remember to tap a hamburger to see where else they can go. The condition: **the table/card treatment below `lg` (§8) has to be designed around content getting 375−64=311px, not the full 375px** — I've done that below. If engineering finds during build that 311px is genuinely too tight for the stacked-card layout, dropping to a 56px rail (still ≥44px tap target, tighter padding) is the fallback, not abandoning the persistent-rail model.

## 8. The data table below `lg` (carried forward, sticky column now added)

**< 640px (phone) — stacked cards.** Unchanged from Rev 1: thumbnail + title, then key fields as labeled key-value pairs, full width, tap to open detail modal. Content width is now 311px (375 − 64px rail) instead of the full 375px assumed in Rev 1 — cards still work fine at this width; nothing in the card layout depends on more than ~300px.

**640–1023px (tablet, rail in compact/expanded mode) — horizontal-scroll table with sticky first column (NEW, in scope this round).**
- Real `<table>`, wrapped in `overflow-x-auto`, scoped to the table only — the page never scrolls horizontally.
- **First column ("Content": thumbnail + title) becomes `position: sticky; left: 0`.** Fixed width band, ~180–220px, title truncates with ellipsis (full title is one tap away via the existing detail modal, confirmed present in `11-detail-modal.png`).
- Sticky column needs a **solid background matching the row background** (not transparent) so scrolled-past columns don't show through underneath it, plus a 1px hairline or subtle shadow on its right edge to signal "this stays, the rest scrolls."
- `z-index` above the scrolling columns so it renders on top during scroll.
- Edge gradient/shadow on the table's own right edge, same as Rev 1, hinting there's more off-screen.

**≥1024px (`lg:`) — table as-is today.** No change.

**Toolbar fix (Columns/Density):** unchanged from Rev 1 — `flex-wrap` so buttons drop to a second line instead of being clipped, 44px-tall touch targets, min 8px gaps.

## 9. Empty state at 375px (unchanged from Rev 1)

Once the sidebar/rail correctly reserves only 64px (not 256px) below `lg`, the empty state's overflow problem disappears as a side effect. "No analyses yet" centers inside a `flex-1` region under the header, not the full viewport height, so it doesn't crowd against the header on short screens.

## 10. Accessibility — updated for the rail

- **Toggle button:** `<button aria-label="Expand navigation" aria-expanded="false" aria-controls="app-nav">`. Label and `aria-expanded` flip together when expanded ("Collapse navigation" / `true`).
- **COMPACT state:** rail is a plain `<nav aria-label="Main">` landmark — **not** a dialog, **not** `inert`. Every icon-only link/button has a real `aria-label` (e.g. `aria-label="Analyses"`). Active item additionally carries `aria-current="page"`. Fully reachable and operable by keyboard (Tab into the rail, Enter/Space activates a link) without ever expanding.
- **EXPANDED state:** rail becomes `role="dialog" aria-modal="true" aria-label="Navigation"`, wrapping `<nav aria-label="Main">`. Background `main` gets `inert` (or `aria-hidden="true"` as fallback) so screen reader users don't land on content that's visually covered by the scrim.
- **Focus trap while EXPANDED:** `Tab`/`Shift+Tab` cycle only within the toggle + nav links inside the rail.
- **Focus on expand:** moves to the first focusable element inside the expanded rail (the toggle itself, since it's the first item — or the first nav link if the toggle is skipped in tab order by design; pick one and be consistent, I'd default to the toggle since it's visually first).
- **Focus restoration on collapse:** always returns to the toggle button — whether triggered by the toggle, scrim tap, or `Esc`.
- **Tap targets:** every icon button, the toggle, and nav links are ≥44×44px even inside the 64px COMPACT rail (44px target centered in 64px width leaves 10px padding each side — comfortable).
- **Contrast:** rail uses the same solid dark background as today's sidebar in both states, so existing text/icon contrast ratios carry over unchanged.

## 11. Design directions considered

Rev 1's two directions (hamburger+drawer vs. bottom tab bar) still apply to the *overall* pattern choice — a bottom tab bar remains rejected for the same reason (one nav item today, not worth two nav patterns). This round's actual decision — compact rail vs. keeping Rev 1's fully-hidden drawer — is documented as the state-machine reconciliation in §3.3, not offered as a second option, because the owner's brief already settled the direction ("think of a rail... rather than a binary open/closed panel"). I'm not re-litigating it, just executing it and flagging the one real cost (§7).

## 12. Open questions for the owner

Carried forward from Rev 1 where still unresolved, plus one new item:

1. **Drawer/rail width on very narrow phones (<360px).** Still open — not decided. Rev 1 assumed a fixed 256px expanded width; this revision keeps that assumption for EXPANDED but flags the same risk: on a 320px phone, a 256px expanded overlay leaves only 64px of scrim showing (25% — a thin but real depth cue that something is layered). **Recommendation:** cap the expanded width at `min(256px, 100vw - 48px)` so at least 48px of scrim always remains visible, confirming to the user there's a layer underneath, rather than the drawer ever reading as a full-screen page swap. Not implemented in the mockup's math, but noted here as the recommendation — needs owner confirmation before lock-in.
2. **Session persistence of EXPANDED state (§3.2).** My default is session-only (survives SPA nav, resets on hard reload). Confirm this matches intent, or state a preference for full `localStorage` persistence across reloads.
3. **56px rail fallback (§7).** Only relevant if engineering finds 311px too tight for cards during build — flagging the fallback exists, not proposing it as primary.

Resolved from Rev 1 and no longer open: breakpoint (`lg`, decision 1), sticky column (decision 2, now designed in §8), auto-close-on-nav-tap (decision 3, superseded by the compact/expanded model), mobile/tablet as supported surfaces (decision 4).

## 13. Non-design note (carrying forward, not mine to fix)

`Sidebar.tsx`'s JSDoc currently claims *"a collapsible layout wrapper"* that has never existed (P3 in the audit). **Note for whoever implements this:** after this ships, the component genuinely *will* have a compact/expanded mechanism — but the JSDoc should describe what it actually does (a two-state icon-rail/overlay-drawer component gated at `lg`, per this spec), not be left as the old generic "collapsible" claim, and not just be deleted either. Update it to match the real behavior.
