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
6. Distinguish, in the data model, a creator the agency manages from a competitor it studies.

---

## 4. New analysis output schema

### 4.1 Structure (two tiers)

**Tier 1 — Style attributes (primary).** Structured, enumerated where possible, designed to be aggregated across a creator's video library.

| Field | Type | Notes |
|---|---|---|
| `topicNiche` | enum (proposed taxonomy, see §4.3) | What the content is about |
| `formatArchetype` | enum (proposed taxonomy) | e.g. talking-head, POV, tutorial, listicle, storytime |
| `hookType` | enum (proposed taxonomy) | e.g. question, shock/contrarian claim, stat, POV cold-open |
| `hookText` | Indonesian string | The actual hook line(s), verbatim/near-verbatim |
| `structureBeatMap` | ordered array of `{ timestampSec, beatType, description }` | `beatType` from a small enum (hook, setup, body/proof, twist, resolution, CTA); `description` is short Indonesian prose |
| `pacing` | enum (slow / medium / fast / mixed) + numeric `estimatedCutsPerMinute` if derivable | Machine-comparable pacing signal |
| `ctaType` | enum (proposed taxonomy) | e.g. follow, comment-prompt, link-in-bio, none |
| `onScreenText` | array of Indonesian strings | Verbatim on-screen text captured, in order of appearance |
| `captionStyleNotes` | Indonesian prose | Tone/voice of the caption text specifically — separate from video style |
| `verbalTonePatterns` | array of short Indonesian tags/phrases | Recurring verbal tics, phrasing style, register (casual/formal/etc.) |

**Tier 2 — Performance/quality scorecard (secondary, retained but reworked).** Same 7-dimension shape as today is a reasonable starting point, but each dimension needs an anchored rubric (§5.3) so scores are comparable across videos. This PRD does not redefine the 7 dimension names themselves — that's a detail the tech lead can carry forward unless the owner wants to revisit it.

- `overallScore` (0–10)
- `scorecard` (7 dimensions, each with anchored band definitions)
- `strengths[]`, `weaknesses[]` — kept as Indonesian prose, now explicitly secondary/supporting color, not the primary planning signal
- `keyMoments[]` — kept, Indonesian prose
- `redFlags[]` — renamed from `patterns.recurringRedFlags`, explicitly single-video (owner, Q1.8)
- `suggestions[]` — kept, Indonesian prose

`patterns.viralFormulas` and `patterns.audiencePsychology` as they exist today should fold into Tier 1's structured fields (`formatArchetype`, `hookType`, etc.) rather than remain free-text — the whole point of this redesign is to stop putting planning-relevant signal into unstructured prose.

### 4.2 Language design decision (needs explicit owner call — see Open Questions)

Human-facing text (hook text, on-screen text, prose fields, captions) stays Indonesian, per the owner's confirmed language decision (Q1.6). Enum **values themselves** (`hookType`, `formatArchetype`, `ctaType`, `topicNiche`, `beatType`) are proposed to be **stable English machine identifiers** (e.g. `hookType: "contrarian_claim"`), with Indonesian labels rendered in the UI via a lookup table — the same pattern as any i18n'd enum. This keeps the data machine-comparable regardless of future UI language changes and avoids brittle string-matching on translated text. **This is a proposal, not a confirmed decision — flagged in Open Questions.**

### 4.3 Proposed starting taxonomies (draft, needs owner sign-off)

These are illustrative starting points, not finalized. They should be short lists initially (5–10 values each) and expanded as real data comes in, rather than over-engineered up front.

- **`hookType`:** `question`, `shock_or_contrarian`, `statistic`, `pov_cold_open`, `relatable_problem`, `direct_promise`, `other`
- **`formatArchetype`:** `talking_head`, `pov`, `tutorial_howto`, `listicle`, `storytime`, `voiceover_montage`, `interview_duet`, `other`
- **`topicNiche`:** left open — the owner's example ("pros and cons of eating eggs everyday") suggests health/food/lifestyle content, but niche taxonomy should probably be informed by what the agency's actual creator roster covers, not guessed here.
- **`ctaType`:** `follow`, `comment_prompt`, `link_in_bio`, `share_prompt`, `save_prompt`, `none`

**All of the above are proposals awaiting owner sign-off**, not confirmed decisions.

### 4.4 Schema versioning

`result_content` gains a `schemaVersion` field (integer or semver string), absent today. Every future schema change increments it, so old and new rows are distinguishable and the UI/generator can branch on it if a hard cutover isn't clean.

---

## 5. Reproducibility fixes (confirmed in scope, owner: "same scope as 1.4 if possible")

1. `temperature: 0.2` → `0`.
2. Replace regex-scraping of JSON out of free text (`parser/analysis.ts`) with Gemini's structured output mode (`responseSchema` / `responseMimeType: "application/json"`), matching the schema in §4.
3. Add anchored rubric text per scorecard dimension — explicit definitions of what a 2, a 5, and an 8 mean for each dimension, not just a name and a one-line gloss. Without this, scores aren't comparable across videos, which breaks both the analysis feature's credibility and the style fingerprint's ability to weight by performance.
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
- **Cold start:** minimum 5 analyzed videos before a style fingerprint is generated for a creator.

### 6.2 Proposed, not yet owner-confirmed

- Surfacing a confidence indicator in the UI (e.g. "based on 5 videos"), and treating 5 as a tunable threshold to raise later once real output quality is observed. Recommended by the owner's own audit but not yet formally signed off as a UI requirement in this PRD.
- Whether higher-performing videos should be weighted more heavily than poor ones when aggregating style — **open question, see §12**.

### 6.3 What the fingerprint needs to contain (derived from §4.1 Tier 1 fields, aggregated)

Aggregation logic (e.g. "most common hookType," "typical pacing," "representative onScreenText patterns," "typical CTA," "caption tone summary") is a technical design decision for the tech lead, not specified in detail here. Functionally, the fingerprint must be rich enough that a generator prompt can say "write this in @creator's style" and have something concrete to condition on — not just "this creator scores 8/10 on visualPolish."

---

## 7. Carousels

Confirmed: a multi-slide carousel (owner's audit example: 7 slides) is analyzed as **one content analysis** — one holistic verdict on how the whole carousel works, with **all slides (images and videos) provided to Gemini as input**, not just the first video slide.

This does not conflict with the existing one-content-per-analysis database constraint (migration 005) — it is one *content item* with multiple *media parts* sent in a single Gemini call, not multiple analyses.

Today, `adapter.ts`'s `resolveVideoChild()` only takes the first video slide, and the download/upload path handles exactly one file. Both need to generalize to N slides. Note: **cost scales with slide count** — this has direct budget implications the tech lead should size (the owner has previously flagged cost variance as something nobody currently tracks, per the audit's Q2.4).

---

## 8. Creator vs. competitor

The agency analyzes both its own managed creators and competitors it studies. The data model must be able to distinguish these two cases — this is a **data-model concern, independent of auth** (auth/multi-tenancy is explicitly deferred, see §11).

**Specification for this PRD:** every profile the system knows about must carry a flag distinguishing "creator the agency manages" from "competitor being studied" (e.g. an `is_own_creator` boolean or equivalent relationship on `profiles`). This matters directly to the style fingerprint and the future generator: a fingerprint should only ever be built from — and a content plan only ever generated in the style of — a managed creator, not a competitor. Competitor analyses feed the generator as reference material (per the owner's brief: "user can supply reference material"), not as a style source to imitate wholesale.

The exact field name, default value, and whether this is set at analysis time or requires a separate "add creator" step are technical design decisions for the tech lead.

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
- A clear signal of whether a given profile is a managed creator or a competitor (§8), since the generator must never accidentally imitate a competitor's tone as if it were the managed creator's own.

---

## 11. Out of scope for this PRD

- Auth / multi-tenancy. The owner asked "is it possible we create auth later?" (Q2.1) — yes, and it's deferred; retrofitting a `user_id`/tenant column at 2 rows is trivial later. This PRD's data model should not be blocked on it.
- The job queue / async pipeline. Confirmed by the owner as the next priority *after* this work (Q2.3 answer: "3rd priority after 1.4"), sequenced after this PRD.
- Bulk ingestion by profile. Depends on the queue above.
- The generator/planner feature's own UI, prompt design, and generation flow — this PRD covers the analysis contract that feeds it (see §10 for what it needs).
- Longitudinal metric snapshots (view/follower history over time). Owner called this "nice to have," not committed (Q1.3).
- Monetization. Personal tool for now (owner, Q2.2).
- Redefining the specific names/count of the 7 scorecard dimensions — carried forward as-is except for rubric anchoring (§5.3); revisiting the dimensions themselves is a separate, smaller decision the tech lead can flag if needed.
- Full `profiles` module expansion (its own UI, full creator profile page) — owner has stated this is a future, separate module (Q2.7).

---

## 12. Open Questions (not answered here — need explicit owner or team decision)

These are genuinely open. Nothing in this PRD should be read as a decision on any of these.

1. **Enum taxonomies.** The `hookType`, `formatArchetype`, `topicNiche`, and `ctaType` value lists in §4.3 are a starting draft only. Needs owner review, especially `topicNiche`, which likely depends on what niches the agency's actual creator roster covers.
2. **Enum identifier language.** §4.2 proposes English machine-stable enum values with Indonesian UI labels. This has not been explicitly confirmed by the owner — it's this PRD's proposal for how structured enums coexist with the Indonesian-language requirement. Needs sign-off before the tech lead builds against it.
3. **Style fingerprint weighting.** Should higher-performing videos (by `overallScore` or specific dimensions) be weighted more heavily than poor ones when computing the aggregate style fingerprint, or should all analyzed videos count equally? Unanswered.
4. **Confidence UI.** Whether "based on 5 videos" (or similar confidence framing) is a required UI element for this phase, or a later nice-to-have. The owner's own audit suggested it; not yet formally confirmed as in-scope UI work.
5. **Cold-start threshold governance.** Who/what raises the 5-video minimum later, and based on what signal ("real output quality observed" per owner, but no defined metric)?
6. **Creator-vs-competitor UX.** Whether flagging a profile as "own creator" vs "competitor" happens automatically, is a manual step the agency takes, or defaults to competitor until explicitly claimed. Not specified by the owner.
7. **Scorecard dimension review.** Whether the 7 existing scorecard dimension names/definitions themselves should be revisited (beyond just adding rubric anchors), given they're described in the owner's audit as "aesthetic-quality judgements" that may not map well to planning primitives. This PRD assumes they carry forward unchanged except for rubric text; the owner has not been asked to confirm that assumption directly.

---

## 13. Summary of confirmed vs. proposed

**Confirmed owner decisions** (from the open-questions doc's inline answers, or the brief's stated ground truth):
- Target user is an Indonesian agency, not the creator; output language Indonesian, UI stays English.
- Product mechanism: "understand what makes MY good posts good, plan more like them."
- Style is the primary purpose of analysis output; performance scoring is secondary.
- Reproducibility fixes (temperature 0, structured output, rubric anchors, no-fabrication-on-failure, schema version) are in scope, same phase.
- Style fingerprint: required, derived from aggregated analyzed videos (not profile metadata), stored separately from `profiles`, versioned, human-editable, includes caption/text style, 5-video cold start minimum.
- "Patterns" relabels to "Red Flags," understood as single-video, not cross-post.
- Carousels: one analysis per carousel, all slides as input.
- Creator vs. competitor distinction needed in the data model, independent of auth.
- No real migration burden; schema can be replaced outright; avoid running new analyses under the old schema during the transition.
- Auth, job queue, bulk ingestion, generator UI, longitudinal snapshots, monetization, and full profile module are explicitly out of scope for this PRD.

**This PRD's own proposals, awaiting sign-off** (do not build against these as if confirmed):
- The specific enum taxonomies in §4.3.
- English-machine-identifier / Indonesian-label pattern for enums (§4.2).
- Confidence-indicator UI framing for the style fingerprint (§6.2).
- Everything listed in §12.
