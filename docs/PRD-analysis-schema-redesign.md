# PRD — Analysis Output Schema Redesign

**Status:** Approved for dev handoff
**Owner:** Oden (product owner)
**Author:** Dan (PM)
**Created:** 2026-07-21
**Sources:** `/docs/product-direction-open-questions.md` (owner answers inline, esp. Q1.1, Q1.2, Q1.4, Q1.5, Q1.6, Q1.7, Q1.8, Q2.1, Q2.6, Q2.7), owner brief for this PRD (2026-07-21). `/docs/product-direction-plan.md` did not exist at time of writing.

---

## 0. Why this is the keystone

Every downstream feature — the style fingerprint, the content plan generator, the profile module, even multi-tenancy — depends on the shape of the data this PRD defines. The owner confirmed (Q1.4) this redesign is next in line, and (Q1.5) that the reproducibility fixes should ship in the same scope if feasible. There is no real corpus yet (2 rows in `analyses`, 1 in `profiles` — Q1 audit), so this is a replacement, not a migration.

**Product framing, confirmed by the owner:** the destination is a content plan generator. A user names a topic; the system produces a detailed brief for one piece of video content, written in a specific creator's style, optionally informed by user-supplied reference material (URLs, free text, or files). Analysis is not just plumbing feeding that generator — it also stays a real, user-facing feature in its own right (Q1.9): when a user gives the generator a video link to analyze, that analysis will also show up in the Analyses feature.

The core mechanism (owner, Q1.7): **"help me understand what makes MY good posts good, then help me plan more like them."** That sentence is the design target for everything below.

---

## 1. Users and context

- **End user:** an Indonesian social media / marketing agency, not the creator. The agency manages multiple creators and analyzes both its own creators' videos and competitor videos (owner, Q1.6, Q2.1).
- **Output language:** analysis output and generated content must be in Indonesian. App UI stays English for now — explicitly not a priority (owner, Q1.6).
- **This is not:** a calendar, scheduler, or cadence planner (brief). Longitudinal metric history is a related but separate concern the owner flagged as "nice to have" (Q1.3) and is out of scope here.

---

## 2. Problem with the current contract

`lib/server/analysis/prompts/system.ts` today returns `overallScore`, `summary`, 7 scorecard dimensions, and free-text `strengths[]`, `weaknesses[]`, `keyMoments[]`, `patterns.{viralFormulas,audiencePsychology,recurringRedFlags}[]`, `suggestions[]`. Per the owner's audit (Q1.4, Q1.5):

- It's entirely unstructured Indonesian prose. Nothing can be aggregated, compared, or fed into a generator that needs to reason over discrete attributes like hook type or format.
- Scores are non-reproducible (`temperature: 0.2`, no seed) and non-comparable (no rubric defining what a 4 vs a 7 means).
- On parse failure, the system currently **invents** data — missing scorecard keys silently become `5`, a missing scorecard object becomes all-5s. This is indistinguishable from a genuine 5/10 score and has been silently happening.
- "Patterns" (labelled "Recurring Red Flags" in the UI) is single-video commentary, not real cross-post pattern mining — the label overstates what the system does (owner, Q1.8: agreed to relabel to "Red Flags").
- Carousels lose everything past the first video slide; image-only carousels get scored on the same `scorecard` shape as a real video, from caption alone.

---

## 3. Goals for the new contract

1. Capture a creator's **style** in structured, enumerated fields, as the primary purpose — because style is what the generator imitates.
2. Keep performance/quality scoring as a secondary layer, useful for "what works for this creator."
3. Make output reproducible and honest: fixed temperature, structured JSON output, anchored score rubrics, loud failures instead of invented data.
4. Support aggregation across a creator's analyzed videos into a persisted, versioned, human-correctable **style fingerprint** — the mechanism behind "understand what makes my good posts good."
5. Support carousels as one holistic analysis over all slides (image and video).
6. Treat every profile identically — one profile model, no managed-creator/competitor split (§8).

---

## 4. New analysis output schema

### 4.1 Structure (two tiers)

**Tier 1 — Style attributes (primary).** Structured, enumerated where possible, designed to be aggregated across a creator's video library.

| Field | Type | Notes |
|---|---|---|
| `topicNiche` | enum (**CONFIRMED** taxonomy, see §4.3) | Broad top-level category the content sits in |
| `topicSubtopic` | free-text Indonesian string | Gemini-filled specific subtopic under `topicNiche`. Deliberately open — see §4.3 |
| `formatArchetype` | enum (draft taxonomy — **not yet signed off**, see §4.3) | e.g. talking-head, POV, tutorial, listicle, storytime |
| `hookType` | enum (**CONFIRMED** taxonomy, see §4.3) | Primary rhetorical strategy of the opening |
| `hookTypeSecondary` | enum (same values), **optional/nullable** | Optional second strategy when a hook genuinely carries two — see §4.3 |
| `hasAudienceCallout` | boolean | Whether the hook explicitly targets an audience segment ("Buat kamu yang…"). Orthogonal to `hookType` — see §4.3 |
| `hookText` | Indonesian string | The actual hook line(s), verbatim/near-verbatim |
| `structureBeatMap` | ordered array of `{ timestampSec, beatType, description }` | `beatType` from a small enum (hook, setup, body/proof, twist, resolution, CTA); `description` is short Indonesian prose |
| `pacing` | enum (slow / medium / fast / mixed) + numeric `estimatedCutsPerMinute` if derivable | Machine-comparable pacing signal |
| `ctaType` | enum (draft taxonomy — **not yet signed off**, see §4.3) | e.g. follow, comment-prompt, link-in-bio, none |
| `onScreenText` | array of Indonesian strings | Verbatim on-screen text captured, in order of appearance |
| `captionStyleNotes` | Indonesian prose | Tone/voice of the caption text specifically — separate from video style |
| `verbalTonePatterns` | array of short Indonesian tags/phrases | Recurring verbal tics, phrasing style, register (casual/formal/etc.) |

**Tier 2 — Performance/quality scorecard (secondary, retained but reworked).** **[CONFIRMED — carried forward unchanged.]** The 7 existing dimensions ship as-is, but each dimension needs an anchored rubric (§5.3) so scores are comparable across videos. The owner has explicitly **deferred** revisiting the dimension names/definitions themselves — he does not yet know what he needs there. That is a known future decision (§12), **not a blocker on this phase**.

- `overallScore` (0–10)
- `scorecard` (7 dimensions, each with anchored band definitions)
- `strengths[]`, `weaknesses[]` — kept as Indonesian prose, now explicitly secondary/supporting color, not the primary planning signal
- `keyMoments[]` — kept, Indonesian prose
- `redFlags[]` — renamed from `patterns.recurringRedFlags`, explicitly single-video (owner, Q1.8)
- `suggestions[]` — kept, Indonesian prose

`patterns.viralFormulas` and `patterns.audiencePsychology` as they exist today should fold into Tier 1's structured fields (`formatArchetype`, `hookType`, etc.) rather than remain free-text — the whole point of this redesign is to stop putting planning-relevant signal into unstructured prose.

### 4.2 Language design decision [CONFIRMED]

Human-facing text (hook text, on-screen text, prose fields, captions, `topicSubtopic`) stays Indonesian, per the owner's confirmed language decision (Q1.6). Enum **values themselves** (`hookType`, `formatArchetype`, `ctaType`, `topicNiche`, `beatType`) are **stable English machine identifiers** (e.g. `hookType: "CONTRARIAN_OPINION"`), with Indonesian labels rendered in the UI via a lookup table — the same pattern as any i18n'd enum. This keeps the data machine-comparable regardless of future UI language changes and avoids brittle string-matching on translated text.

**Confirmed by the owner exactly as proposed.** Build against it.

### 4.3 Taxonomies

`topicNiche` and `hookType` are **CONFIRMED**. `formatArchetype` and `ctaType` remain **drafts awaiting owner sign-off** — see §12.

#### 4.3.1 `topicNiche` — hybrid enum + free text [CONFIRMED]

Not a closed enum. A **broad top-level enum** plus a **free-text `topicSubtopic`** field Gemini fills in.

**Rationale (owner):** an agency onboarding varied creators will constantly hit the edges of a closed list. The hybrid gives clean aggregation at the top level ("80% kuliner") without requiring a schema/enum edit every time a new creator arrives with an unanticipated niche. The specificity that would have forced constant enum churn lives in `topicSubtopic` instead, where it costs nothing.

**Top-level values** (weighted toward the Indonesian creator economy):

`FOOD_CULINARY`, `BEAUTY_SKINCARE`, `FASHION_STYLE`, `HEALTH_FITNESS`, `FINANCE_INVESTING`, `BUSINESS_ENTREPRENEURSHIP`, `EDUCATION_SKILLS`, `TECH_GADGETS`, `PARENTING_FAMILY`, `RELIGION_SPIRITUALITY`, `TRAVEL`, `COMEDY_ENTERTAINMENT`, `LIFESTYLE_DAILY`, `HOME_INTERIOR`, `AUTOMOTIVE`, `GAMING`, `RELATIONSHIPS`, `OTHER`.

Two notes to carry into implementation:

- **`RELIGION_SPIRITUALITY` is deliberately included.** Islamic/dakwah content is a large segment of the Indonesian market and is exactly the category that gets dropped when a Western taxonomy is ported over unexamined. It is not optional.
- **Frequent `OTHER` classification is a signal, not noise.** If a niche keeps landing in `OTHER`, that is evidence the enum needs a new top-level value. Do not suppress or hide the `OTHER` rate.

#### 4.3.2 `hookType` — confirmed taxonomy, research-derived [CONFIRMED]

**Provenance:** this taxonomy was derived by analyzing all **1,003 hooks** in a viral-hooks reference PDF (`~/Downloads/1,000 Viral Hooks (PBL).pdf`), a US-sourced copywriting swipe file.

**The PDF's own native sectioning was explicitly REJECTED as the taxonomy.** Its six sections (EDUCATIONAL / STORYTELLING / COMPARISON / MYTH BUSTING / AUTHORITY / DAY IN THE LIFE) are unusable for our purpose: **two of them hold ~85% of the corpus**, and they are *topical* labels rather than *rhetorical strategies*. They would have near-zero aggregation value — "this creator is 47% educational" is true of essentially everyone and tells the generator nothing.

**Final `hookType` enum — 17 values + `OTHER`:**

| Identifier | Definition |
|---|---|
| `DIRECT_VALUE_PROMISE` | States plainly what the viewer will learn/get, often with time or effort compression. Tutorial framing. |
| `NUMBERED_LIST` | Opens with an explicit count, enumeration, or ranking as the organizing device. |
| `CURIOSITY_QUESTION` | Opens with a direct question whose answer is withheld. |
| `SIDE_BY_SIDE_COMPARISON` | Two concrete options/groups/quantities set against each other, usually with visual parity. |
| `MYTH_CORRECTION` | Asserts a widely-held belief is factually wrong, then corrects it. Cites or implies evidence. |
| `WARNING_MISTAKE` | Imperative prohibition or consequence warning. Loss-framed. |
| `CONTRARIAN_OPINION` | Stakes a personal, socially risky position against consensus. Stated as personal belief, not fact-correction. |
| `SECRET_INSIDER_REVEAL` | Frames content as withheld, gatekept, or unfairly advantageous knowledge. |
| `RESULT_PROOF` | Leads with a concrete achieved outcome or before→after transformation as evidence. **Absorbs credential/authority openings** (leading with title, tenure, or status). |
| `PERSONAL_STORY_OPENER` | Opens mid-narrative with a time marker or inciting incident; payoff is the story. **Absorbs confession/vulnerability openings.** |
| `PROCESS_JOURNEY_SERIES` | Positions the video as an installment in an ongoing serialized effort. Includes day-in-the-life. |
| `VISUAL_DEMONSTRATION` | Show-don't-tell: points at one thing on screen and starts doing/building/revealing it. |
| `SHOCK_STATEMENT` | A single startling or alarming assertion with no setup. |
| `RELATABLE_PAIN_POINT` | Names a frustration the viewer is already living. Recognition, not promise or instruction. |
| `EXPERIMENT_CHALLENGE` | "I tried X for N days/weeks" framing. **Added preemptively for the Indonesian market** ("aku coba X selama 30 hari") — under-represented in the US-sourced PDF but far more prevalent in Indonesian short-form. |
| `TEXT_OVERLAY_ONLY` | Opens with an on-screen text hook and no verbal hook. |
| `COLD_OPEN_ACTION` | Opens with silent action / a trending audio drop / no verbal or text hook at all. |
| `OTHER` | Escape hatch. |

**Why the last three exist — structural reasoning, record it.** The source PDF is a *copywriting swipe file*, so every category it is capable of teaching is **verbal**. But we are classifying **VIDEO**, and a large share of Reels/Shorts open with **no verbal hook at all** — text overlay only, a silent cold open, or a trending audio drop. Without `TEXT_OVERLAY_ONLY` and `COLD_OPEN_ACTION` these videos get dumped into `VISUAL_DEMONSTRATION` and `OTHER`, which distorts **every** fingerprint built on this data.

**Two research categories were deliberately MERGED** for classification reliability. Both pairs differ by *intent* rather than *form*, so an LLM would be inconsistent at the boundary and produce noisy aggregates:

- confession / vulnerability → `PERSONAL_STORY_OPENER`
- credential / authority → `RESULT_PROOF`

#### 4.3.3 `hasAudienceCallout` — a separate boolean, NOT a `hookType` value [CONFIRMED]

Audience-targeting ("If you're between 25 and 35 and you want to…", Indonesian "Buat kamu yang…") is a **syntactic wrapper, not a peer strategy**. A single video can simultaneously be an audience callout AND a numbered list AND a warning.

In the source corpus it was the **single largest bucket (~10%)** and collided with other labels constantly. As an enum value it would swallow everything else and hollow out the taxonomy. It is also the construction Indonesian maps to **most** naturally, which would make the problem worse, not better.

Therefore: **a separate boolean field, orthogonal to `hookType`.**

#### 4.3.4 Primary + optional secondary hook label [CONFIRMED]

Gemini emits a **primary `hookType`** and an **OPTIONAL secondary** (`hookTypeSecondary`, nullable).

**~13% of the source corpus legitimately carries two strategies.** Forcing a single label on those would inject arbitrary, non-recoverable noise directly into the fingerprint aggregate.

#### 4.3.5 Prompt-engineering requirements [CONFIRMED]

These are requirements on the prompt in `system.ts`, not optional polish.

- **Localize the few-shot examples into Indonesian.** Keep the category definitions and English identifiers exactly as-is, but the **example hooks used as few-shot anchors must be translated/localized**. The PDF's verbatim examples are heavy with American subject matter ("tier list", "9-5", "de-influence", US suburban home renovation), and Gemini may over-anchor on that *content* rather than on the underlying *rhetorical strategy*.
- **Explicit discriminator rules are required in the prompt** for the two known-collision pairs:
  - `VISUAL_DEMONSTRATION` vs `SIDE_BY_SIDE_COMPARISON` — both open "This is (noun)…". **Rule:** two items contrasted → `SIDE_BY_SIDE_COMPARISON`; one item shown → `VISUAL_DEMONSTRATION`.
  - `MYTH_CORRECTION` vs `CONTRARIAN_OPINION` — **Rule:** `MYTH_CORRECTION` cites or implies evidence; `CONTRARIAN_OPINION` is stated as personal belief.
- **Instrument `OTHER`.** Target **under 10%** of classifications. If it exceeds **~15%** in production, the taxonomy is missing something Indonesian-specific and must be revisited.
- **Indonesian cultural caveat — record it so it isn't misread as a data bug.** `CONTRARIAN_OPINION` and authority-style openings are expected to **UNDER-fire** in Indonesian. Direct self-elevation and public disagreement read as rude in a higher-context, humility-normed register; Indonesian creators achieve the same effect obliquely (*"dulu aku juga gitu…"*), which will land in `RESULT_PROOF` or `PERSONAL_STORY_OPENER` instead. **A low count must NOT be read as "no Indonesian creator claims authority."**

#### 4.3.6 Still draft — `formatArchetype` and `ctaType` [OPEN]

These value lists have **not** been reviewed by the owner. They are illustrative starting points only and need sign-off before the tech lead builds against them (§12).

- **`formatArchetype` (DRAFT):** `talking_head`, `pov`, `tutorial_howto`, `listicle`, `storytime`, `voiceover_montage`, `interview_duet`, `other`
- **`ctaType` (DRAFT):** `follow`, `comment_prompt`, `link_in_bio`, `share_prompt`, `save_prompt`, `none`

### 4.4 Schema versioning

`result_content` gains a `schemaVersion` field (integer or semver string), absent today. Every future schema change increments it, so old and new rows are distinguishable and the UI/generator can branch on it if a hard cutover isn't clean.

---

## 5. Reproducibility fixes (confirmed in scope, owner: "same scope as 1.4 if possible")

1. `temperature: 0.2` → `0`.
2. Replace regex-scraping of JSON out of free text (`parser/analysis.ts`) with Gemini's structured output mode (`responseSchema` / `responseMimeType: "application/json"`), matching the schema in §4.
3. Add anchored rubric text per scorecard dimension — explicit definitions of what a 2, a 5, and an 8 mean for each dimension, not just a name and a one-line gloss. Without this, scores aren't comparable across videos, which breaks the analysis feature's credibility and any "what works for this creator" reading of the scorecard. (Note: the fingerprint itself does **not** weight by performance — §6.1 — but comparable scores are still required for the scorecard to mean anything.)
4. **Parse/validation failures become loud errors, not invented data.** Today, a missing scorecard key silently becomes `5`; a missing scorecard object becomes all-5s indistinguishable from a real score. This must fail the analysis (status = `failed`, surfaced to the user) rather than fabricate a result. The owner should expect this to surface failures that are currently invisible — that is the intended effect, not a regression.
5. Add `schemaVersion` to `result_content` (§4.4).

---

## 6. Style fingerprint (cross-post aggregation)

Confirmed required, not optional — this is the direct implementation of "help me understand what makes MY good posts good, then help me plan more like them" (owner, Q1.7).

### 6.1 Confirmed decisions

- **Derivation:** the style fingerprint is computed by **aggregating a creator's already-analyzed videos** (their Tier 1 style attributes across videos). It is explicitly **not** a separate analysis pass over profile metadata — a bio and profile picture say nothing about speaking tone.
- **Storage:** a derived, **versioned**, persisted record — computed and stored, not recomputed on the fly at generation time.
- **Separation from `profiles`:** stored in its own structure, kept separate from the `profiles` table. `profiles` holds scraped facts; the style fingerprint holds inferred style. The owner explicitly does not want these mixed, citing the existing nullable-boolean coercion bug in the profiles layer as the failure pattern to avoid — "unknown" must never silently become a wrong concrete value.
- **Editability:** human-editable / overridable. The agency will want to correct the system (e.g. "no, this creator's tone is warmer than that"), and corrections should improve future generations, not just cosmetically override the display.
- **Scope:** must include caption/text style, not just video style.
- **Cold start:** minimum 5 analyzed videos before a style fingerprint is generated for a creator. **Stays at 5.** There is no formal governance process and no defined metric for changing it — the owner will revisit it informally once real output quality is observed. Do not over-specify this.
- **Confidence indicator:** surfacing sample size in the UI (e.g. "based on 5 videos") is **in scope for this phase**, on the generation surface and on the profile page. The agency should never be guessing how much evidence sits behind a brief.
- **Weighting:** **all analyzed videos count equally.** No performance-based weighting. Do **not** weight by `overallScore` or by any individual scorecard dimension when aggregating style.

### 6.2 (resolved — formerly "proposed, not yet owner-confirmed")

Everything previously listed here has been confirmed by the owner and folded into §6.1. Nothing in the style fingerprint scope remains open.

### 6.3 What the fingerprint needs to contain (derived from §4.1 Tier 1 fields, aggregated)

Aggregation logic (e.g. "most common hookType," "typical pacing," "representative onScreenText patterns," "typical CTA," "caption tone summary") is a technical design decision for the tech lead, not specified in detail here. Functionally, the fingerprint must be rich enough that a generator prompt can say "write this in @creator's style" and have something concrete to condition on — not just "this creator scores 8/10 on visualPolish."

---

## 7. Carousels

Confirmed: a multi-slide carousel (owner's audit example: 7 slides) is analyzed as **one content analysis** — one holistic verdict on how the whole carousel works, with **all slides (images and videos) provided to Gemini as input**, not just the first video slide.

This does not conflict with the existing one-content-per-analysis database constraint (migration 005) — it is one *content item* with multiple *media parts* sent in a single Gemini call, not multiple analyses.

Today, `adapter.ts`'s `resolveVideoChild()` only takes the first video slide, and the download/upload path handles exactly one file. Both need to generalize to N slides. Note: **cost scales with slide count** — this has direct budget implications the tech lead should size (the owner has previously flagged cost variance as something nobody currently tracks, per the audit's Q2.4).

---

## 8. Creator vs. competitor — REVERSED [CONFIRMED]

**There will be NO creator/competitor distinction. No `is_own_creator` flag, no separate data model, nothing.** One profile model. Every profile is treated identically — same scraped fields, same analyses, same aggregation, same style fingerprint, same ability to generate in its style.

An earlier revision of this PRD specified a managed-creator/competitor flag. **That decision is reversed.** Rationale, recorded so it isn't relitigated:

- **There was never a meaningful *data model* difference.** A profile is a profile. Same scraped fields, same analyses, same aggregation logic. The split would have duplicated structure without any of it diverging.
- **The flag's only real purpose was preventing accidental generation in a competitor's voice.** But the agency explicitly picks whose profile page they are on when they hit Generate (generation lives under the creator's profile page). The choice is already explicit in the UI. **The flag guarded against a mistake the interface does not permit.**
- **Upside: not differentiating makes "generate something in @competitor's style" a legitimate, free capability.** An agency that wants *"make me something like what that account does"* is a genuinely useful case, and a creator/competitor split would have blocked it for no benefit. **Record this as a deliberate feature, not an accident of the simplification.**
- **Reversible at trivial cost.** If a concrete need to distinguish the two emerges later, adding a boolean is an afternoon.

---

## 9. Migration / rollout

- There are only 2 rows in `analyses` and 1 row in `profiles` today — no real corpus, no real users. The schema can simply be **replaced**, not migrated. No backfill logic is required.
- **Explicit instruction to the team:** analyses should ideally not be run under the old schema during the interim period while this is being built, since anything produced under the old contract will need to be re-run under the new one anyway. This was already flagged as a cost-of-delay concern in the owner's own audit.

---

## 10. What the generator will need from this contract

This PRD does not specify the generator/planner feature itself (out of scope, §11), but per the brief, the contract must be specified well enough that the generator can consume it. Concretely, the generator will need:

- A creator's **style fingerprint** (§6) to write "in this creator's style."
- The ability to pull in **reference material** the user supplies at generation time (pasted URLs to analyze on the spot, free text, or uploaded files) — meaning the analysis pipeline must be invocable as a step inside a generation flow, not just as a standalone user action.
- Tier 1 structured fields from individual analyses (not just the aggregate fingerprint) if the generator wants to say "in your last 3 videos you did X" as supporting evidence within the brief.

---

## 11. Out of scope for this PRD

- Auth / multi-tenancy. The owner asked "is it possible we create auth later?" (Q2.1) — yes, and it's deferred; retrofitting a `user_id`/tenant column at 2 rows is trivial later. This PRD's data model should not be blocked on it.
- The job queue / async pipeline. Confirmed by the owner as the next priority *after* this work (Q2.3 answer: "3rd priority after 1.4"), sequenced after this PRD.
- Bulk ingestion by profile. Depends on the queue above.
- The generator/planner feature's own UI, prompt design, and generation flow — this PRD covers the analysis contract that feeds it (see §10 for what it needs).
- Longitudinal metric snapshots (view/follower history over time). Owner called this "nice to have," not committed (Q1.3).
- Monetization. Personal tool for now (owner, Q2.2).
- Redefining the specific names/count of the 7 scorecard dimensions — **explicitly deferred by the owner**, who has stated he does not yet know what he needs here. Carried forward as-is except for rubric anchoring (§5.3). A known future decision (§12), not a blocker on this phase.
- Full `profiles` module expansion (its own UI, full creator profile page) — owner has stated this is a future, separate module (Q2.7).

---

## 12. Open Questions

Most of the original open questions have been closed by owner decision. What remains genuinely open is listed first; the resolved ones are recorded below it so nobody re-opens them.

### Still open — do not invent answers

1. **`formatArchetype` and `ctaType` value lists (§4.3.6).** Drafts only. **Not reviewed by the owner.** Need explicit sign-off before the tech lead builds against them. `topicNiche` and `hookType` are settled (§4.3.1, §4.3.2); these two are not.

### Known future decision — not a blocker

2. **Scorecard dimension review.** Whether the 7 existing scorecard dimension names/definitions should be revisited (beyond adding rubric anchors), given they're described in the owner's audit as "aesthetic-quality judgements" that may not map well to planning primitives. **DEFERRED by the owner — he explicitly said he does not yet know what he needs here.** The 7 dimensions carry forward unchanged for this phase (rubric anchoring still applies, §5.3). Listed as a known future decision, **not** a blocker on Phase 2.

### Resolved by owner decision (formerly open)

- ~~**Enum identifier language.**~~ **CONFIRMED** exactly as §4.2 proposed: English machine-stable identifiers, Indonesian UI labels via lookup.
- ~~**Style fingerprint weighting.**~~ **CONFIRMED:** all analyzed videos count equally. No performance weighting of any kind (§6.1).
- ~~**Confidence UI.**~~ **CONFIRMED in scope for this phase** (§6.1).
- ~~**Cold-start threshold governance.**~~ **CONFIRMED:** stays at 5. No formal governance process and no defined metric — revisit informally once real output quality is observed. Deliberately not over-specified.
- ~~**Creator-vs-competitor UX.**~~ **Moot.** The distinction itself was removed (§8) — there is no flag to set, so there is no UX for setting it.
- ~~**`topicNiche` / `hookType` taxonomies.**~~ **CONFIRMED** — see §4.3.1 and §4.3.2.

---

## 13. Summary of confirmed vs. proposed

**Confirmed owner decisions** (from the open-questions doc's inline answers, or the brief's stated ground truth):
- Target user is an Indonesian agency, not the creator; output language Indonesian, UI stays English.
- Product mechanism: "understand what makes MY good posts good, plan more like them."
- Style is the primary purpose of analysis output; performance scoring is secondary.
- Reproducibility fixes (temperature 0, structured output, rubric anchors, no-fabrication-on-failure, schema version) are in scope, same phase.
- Style fingerprint: required, derived from aggregated analyzed videos (not profile metadata), stored separately from `profiles`, versioned, human-editable, includes caption/text style, 5-video cold start minimum, **all videos weighted equally**, **confidence indicator in scope**.
- "Patterns" relabels to "Red Flags," understood as single-video, not cross-post.
- Carousels: one analysis per carousel, all slides as input.
- **NO creator-vs-competitor distinction.** One profile model, treated identically — decision reversed (§8). Generating in a competitor's style is a deliberate, supported capability.
- Enum identifiers are English and machine-stable; UI labels are Indonesian (§4.2).
- `topicNiche` is a hybrid: broad top-level enum + free-text `topicSubtopic` (§4.3.1).
- `hookType` is a confirmed 17-value + `OTHER` taxonomy with an optional secondary label, plus a separate `hasAudienceCallout` boolean (§4.3.2–§4.3.4).
- Prompt requirements: Indonesian-localized few-shot examples, explicit discriminator rules for the two collision pairs, `OTHER`-rate instrumentation (§4.3.5).
- No real migration burden; schema can be replaced outright; avoid running new analyses under the old schema during the transition.
- Auth, job queue, bulk ingestion, generator UI, longitudinal snapshots, monetization, and full profile module are explicitly out of scope for this PRD.

**Still awaiting sign-off** (do not build against these as if confirmed):
- The `formatArchetype` and `ctaType` draft value lists (§4.3.6). These are the **only** taxonomies still unapproved.

**Known future decision, not blocking:**
- Review of the 7 scorecard dimension names/definitions (§12) — deferred by the owner; dimensions carry forward unchanged for this phase.
