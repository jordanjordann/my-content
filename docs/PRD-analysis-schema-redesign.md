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
- On parse failure, the system currently **invents** data — missing scorecard keys silently become `5`, a missing scorecard object becomes all-5s. On the old 1–10 scale this was indistinguishable from a genuine mid-range score and has been silently happening. (Note that on the confirmed 1–5 scale, §4.6, the same fabricated `5` would read as a **perfect** score — which makes fixing this per §5.4 more urgent, not less.)
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
| `formatArchetype` | enum (**CONFIRMED** taxonomy, 14 values + `OTHER`, see §4.3.6) | The video's **production form** — what it physically looks like / how it's shot. Distinct from `hookType` (how it opens) and `topicNiche` (what it's about) |
| `hookType` | enum (**CONFIRMED** taxonomy, see §4.3) | Primary rhetorical strategy of the opening |
| `hookTypeSecondary` | enum (same values), **optional/nullable** | Optional second strategy when a hook genuinely carries two — see §4.3 |
| `hasAudienceCallout` | boolean | Whether the hook explicitly targets an audience segment ("Buat kamu yang…"). Orthogonal to `hookType` — see §4.3 |
| `hookText` | Indonesian string | The actual hook line(s), verbatim/near-verbatim |
| `structureBeatMap` | ordered array of `{ timestampSec, beatType, description }` | `beatType` from a small enum (hook, setup, body/proof, twist, resolution, CTA); `description` is short Indonesian prose |
| `pacing` | enum (slow / medium / fast / mixed) + numeric `estimatedCutsPerMinute` if derivable | Machine-comparable pacing signal |
| `ctaType` | **array** of enum values (**CONFIRMED** taxonomy, 11 values + `NONE` + `OTHER`, see §4.3.6) | Videos routinely stack CTAs, so this is a set, not a single value. `NONE` must be the **sole** element when present. Empty array is **invalid** — absence of a CTA is represented as `["NONE"]` |
| `ctaTiming` | enum (**CONFIRMED**), `EARLY` / `MID` / `END` / `NONE`, see §4.3.6 | **Where** in the video the ask lands, as distinct from `ctaType` (**what** the ask is). Single value, not an array. Must be `NONE` if and only if `ctaType` is `["NONE"]` — see the consistency rule in §4.3.6 |
| `onScreenText` | array of Indonesian strings | Verbatim on-screen text captured, in order of appearance |
| `captionStyleNotes` | Indonesian prose | Tone/voice of the caption text specifically — separate from video style |
| `verbalTonePatterns` | array of short Indonesian tags/phrases | Recurring verbal tics, phrasing style, register (casual/formal/etc.) |

**Tier 2 — Performance/quality scorecard (secondary, retained but reworked).** **[CONFIRMED — dimensions redesigned, see §4.5.]** The scorecard stays 7 dimensions, but three of the original seven are removed and three new ones added, one is renamed and rescoped, and one is widened. Every dimension needs an anchored rubric (§5.3) so scores are comparable across videos. **All scores move from a 1–10 scale to a 1–5 scale (§4.6).**

- `overallScore` (**1–5**)
- `scorecard` (7 dimensions — see §4.5 — each **1–5**, with anchored band definitions)
- `strengths[]`, `weaknesses[]` — kept as Indonesian prose, now explicitly secondary/supporting color, not the primary planning signal
- `keyMoments[]` — kept, Indonesian prose
- `redFlags[]` — renamed from `patterns.recurringRedFlags`, explicitly single-video (owner, Q1.8)
- `suggestions[]` — kept, Indonesian prose

`patterns.viralFormulas` and `patterns.audiencePsychology` as they exist today should fold into Tier 1's structured fields rather than remain free-text — the whole point of this redesign is to stop putting planning-relevant signal into unstructured prose. This now holds fully: with all four Tier 1 taxonomies confirmed (`topicNiche`, `hookType`, `formatArchetype`, `ctaType` — §4.3), there is a concrete structured destination for each. `viralFormulas` decomposes into `formatArchetype` + `hookType`/`hookTypeSecondary` + `structureBeatMap` + `pacing`; `audiencePsychology` decomposes into `hasAudienceCallout` + `hookType` + `ctaType` + `verbalTonePatterns`. Neither free-text field survives into the new contract.

### 4.2 Language design decision [CONFIRMED]

Human-facing text (hook text, on-screen text, prose fields, captions, `topicSubtopic`) stays Indonesian, per the owner's confirmed language decision (Q1.6). Enum **values themselves** (`hookType`, `formatArchetype`, `ctaType`, `topicNiche`, `beatType`) are **stable English machine identifiers** (e.g. `hookType: "CONTRARIAN_OPINION"`), with Indonesian labels rendered in the UI via a lookup table — the same pattern as any i18n'd enum. This keeps the data machine-comparable regardless of future UI language changes and avoids brittle string-matching on translated text.

**Confirmed by the owner exactly as proposed.** Build against it.

### 4.3 Taxonomies

All Tier 1 taxonomies — `topicNiche`, `hookType`, `formatArchetype`, `ctaType` and `ctaTiming` — are now **CONFIRMED** by the owner. There is no unapproved taxonomy or field left in this PRD. Build against them.

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

#### 4.3.6 `formatArchetype`, `ctaType` and `ctaTiming` — confirmed taxonomies [CONFIRMED]

Both were reviewed by the owner and **confirmed**. In both cases the earlier draft value lists were **REJECTED outright, not amended** — the confirmed lists below replace them entirely. The rejection reasoning is recorded because it is exactly the kind of thing that gets relitigated.

##### `formatArchetype` [CONFIRMED]

**Definition.** `formatArchetype` describes the video's **production form** — what it physically looks like and how it is shot. It is deliberately orthogonal to the other two content dimensions:

- `formatArchetype` — **how it's made** (production form)
- `hookType` — **how it opens** (rhetorical strategy)
- `topicNiche` — **what it's about** (subject matter)

**Why the earlier draft was rejected.** The draft list (`talking_head`, `pov`, `tutorial_howto`, `listicle`, `storytime`, `voiceover_montage`, `interview_duet`, `other`) failed on two counts:

- **It duplicated `hookType`.** `listicle` and `storytime` are the same signal as the `NUMBERED_LIST` and `PERSONAL_STORY_OPENER` hook values (§4.3.2). Two dimensions measuring the same thing produce a correlated, redundant fingerprint with no added signal — the aggregate would just report the same fact twice and imply corroboration that isn't there.
- **`interview_duet` conflated two genuinely different production formats** — interviewing a person on camera, and duetting/stitching someone else's video. These are split below into `INTERVIEW_STREET` and `REACTION_STITCH`.

**Confirmed `formatArchetype` enum — 14 values + `OTHER`:**

| Identifier | Definition |
|---|---|
| `TALKING_HEAD` | Person speaking direct to camera; their face is the primary visual |
| `VOICEOVER_BROLL` | Narration over footage that is not the speaker |
| `POV_SKIT` | Acted scenario or character; "POV:" framing, sketch comedy |
| `TUTORIAL_DEMO` | Step-by-step instruction showing a process being performed |
| `PRODUCT_REVIEW` | Evaluating or showcasing a specific product |
| `TRANSFORMATION_REVEAL` | Before→after structure — makeover, build, glow-up |
| `GREEN_SCREEN_COMMENTARY` | Creator overlaid on referenced media (article, post, another video) |
| `REACTION_STITCH` | Responding to someone else's content |
| `INTERVIEW_STREET` | Q&A with another person; vox pop |
| `TEXT_SLIDESHOW` | Sequence of text cards or images, minimal or no speaking |
| `VLOG_DAILY` | Documentary-style, following an activity |
| `PROCESS_ASMR` | Satisfying process footage, minimal narration |
| `PERFORMANCE` | Dance, lip-sync, music, trending-audio format |
| `CAROUSEL_STATIC` | Multi-image carousel with no video content |
| `OTHER` | Escape hatch |

**Two notes to carry into implementation:**

- **`INTERVIEW_STREET`, `PERFORMANCE` and `GREEN_SCREEN_COMMENTARY` were included deliberately for the Indonesian market.** All three are disproportionately common in Indonesian short-form and are the kind of value that gets dropped when a Western format list is ported over unexamined.
- **`CAROUSEL_STATIC` exists because carousels are analyzed as a single content unit (§7).** An all-image carousel still has to receive a valid archetype, and there is no video production form to describe. It also pairs naturally with `analysis_mode: metadata_only`.

##### `ctaType` [CONFIRMED] — and it becomes an ARRAY

**Why the earlier draft was rejected.** The draft list (`follow`, `comment_prompt`, `link_in_bio`, `share_prompt`, `save_prompt`, `none`) contained **no commercial CTAs whatsoever**. The target user is a marketing agency; "buy this," "DM to order," "use this code" is the core of a large share of the content they handle. As drafted, the taxonomy could not distinguish a paid brand campaign from an ordinary personal post — a serious gap for the generator, which needs to know a creator's **characteristic commercial ask**.

**Confirmed `ctaType` enum — 11 values + `NONE` + `OTHER`:**

| Identifier | Ask |
|---|---|
| `FOLLOW` | Follow / subscribe |
| `COMMENT_PROMPT` | Ask a question, "comment X below" |
| `SAVE_PROMPT` | "Save this for later" |
| `SHARE_PROMPT` | "Send this to someone who…" |
| `LINK_IN_BIO` | Directs to the profile bio link |
| `SHOP_PURCHASE` | Buy — checkout, "keranjang kuning," TikTok Shop / Shopee |
| `DM_INQUIRY` | "DM me," "chat admin" |
| `JOIN_COMMUNITY` | WhatsApp/Telegram group, class, waitlist |
| `SIGN_UP_REGISTER` | Form, webinar, event registration |
| `WATCH_NEXT` | Part 2 / series continuation |
| `DISCOUNT_CODE` | "Use code X" |
| `NONE` | No explicit call to action |
| `OTHER` | Escape hatch |

**Structural change — `ctaType` is an ARRAY, not a single enum value.** Videos routinely stack CTAs ("follow for more, save this, link's in bio"), and forcing a single label discards real signal. This is the same reasoning that produced the confirmed primary + optional secondary `hookType` (§4.3.4), applied to a field where the stacking is even more common.

Validity rules — these are **hard constraints**, to be enforced in the response schema and in validation, not left to the model:

- The value is an **array of enum identifiers**, order-insignificant, no duplicates.
- **`NONE` must be the sole element when present.** An array containing `NONE` alongside any other value is **invalid** and must fail validation (§5.4 — loud errors, not invented data).
- **An empty array is invalid.** "No CTA" has exactly one representation: `["NONE"]`. This is chosen deliberately over an empty array so that "the model found no CTA" and "the model failed to populate the field" are not the same value on the wire.

**Indonesian relevance to record.** `SHOP_PURCHASE` and `JOIN_COMMUNITY` matter especially here. Yellow-basket checkout (Shopee / TikTok Shop) and WhatsApp-group funnels are pervasive in the Indonesian market and are the two commercial asks most likely to be under-modelled by a taxonomy built from Western examples.

##### `ctaTiming` [CONFIRMED]

**Definition.** `ctaTiming` records **where in the video the call-to-action lands**. It is a single enum value and is orthogonal to `ctaType`: `ctaType` is *what the ask is*, `ctaTiming` is *when it is made*.

| Identifier | Meaning |
|---|---|
| `EARLY` | The ask lands in the opening portion, before the main payoff |
| `MID` | The ask lands in the body, typically right after the payoff/reveal |
| `END` | The ask lands in the closing portion, after the content has been delivered |
| `NONE` | No call to action in the video — see the consistency rule below |

**Why it is in the schema.** CTA placement is a deliberate, imitable creator technique with materially different outcomes. An early CTA catches viewers before they scroll but risks reading as pushy; an end CTA reaches a smaller but much higher-intent audience; a mid-video CTA placed right after the payoff catches peak goodwill. The style fingerprint exists to capture imitable patterns, and *"this creator characteristically asks for the save at the end, after the reveal"* is a concrete instruction the generator can act on. Without it the generator knows **that** a creator uses `SAVE_PROMPT` but not **where to put it**, so placement would be arbitrary and the output subtly off-brand.

**Cost.** One enum field. Gemini already watches the full video and reports `keyMoments`, so the timing information is already observed — it simply isn't being requested today. Adding it now is effectively free (the `analyses` table holds 2 rows); retrofitting it later would require re-running the entire corpus to backfill, consistent with the rollout reasoning in §9.

**Consistency rule with `ctaType` — specified here, not left to the implementer.** `NONE` now appears in both fields and the two must never contradict each other:

- If `ctaType` is `["NONE"]`, then `ctaTiming` **must** be `NONE`.
- If `ctaTiming` is `NONE`, then `ctaType` **must** be `["NONE"]`.
- The two `NONE`s are therefore **biconditional**. Any other combination — a real `ctaType` paired with `ctaTiming: NONE`, or `ctaType: ["NONE"]` paired with `EARLY`/`MID`/`END` — is **invalid** and must fail validation loudly (§5.4), not be silently coerced or repaired.
- When `ctaType` carries multiple stacked CTAs landing at different points, `ctaTiming` records the placement of the **primary/most prominent** ask. This is a deliberate simplification: per-CTA timing is not modelled.

##### Prompt-engineering requirements for these taxonomies [CONFIRMED]

Previously carried here as a tech-lead recommendation by analogy with §4.3.5. **The owner has since approved both parts** — the `formatArchetype` discriminator rules and the `["NONE"]`-rate instrumentation. They are requirements on the prompt in `system.ts`, not optional polish.

`formatArchetype` has real collision risk and gets the same treatment §4.3.5 mandates for `hookType`: Indonesian-localized few-shot examples, explicit discriminator rules, and `OTHER`-rate instrumentation (same <10% target, same ~15% revisit trigger). **Rationale for the discriminator rules, recorded:** this is the same treatment that made `hookType` reliable. Without it these pairs classify inconsistently run-to-run, and because `formatArchetype` feeds the style fingerprint directly (§6.3), that inconsistency does not stay local — it pollutes the aggregate.

Confirmed discriminator rules for the collision-prone pairs:

- **`VOICEOVER_BROLL` vs `PROCESS_ASMR`** — narration carries the meaning → `VOICEOVER_BROLL`; the footage carries it and narration is absent or incidental → `PROCESS_ASMR`.
- **`TUTORIAL_DEMO` vs `PRODUCT_REVIEW`** — teaches a repeatable process the viewer could perform → `TUTORIAL_DEMO`; evaluates or showcases a specific product → `PRODUCT_REVIEW`.
- **`POV_SKIT` vs `PERFORMANCE`** — acted scenario with a character and a narrative beat → `POV_SKIT`; dance/lip-sync/trending-audio execution with no scenario → `PERFORMANCE`.
- **`TALKING_HEAD` vs `GREEN_SCREEN_COMMENTARY`** — creator alone on frame → `TALKING_HEAD`; creator overlaid on referenced media → `GREEN_SCREEN_COMMENTARY`.
- **`REACTION_STITCH` vs `GREEN_SCREEN_COMMENTARY`** — both reference third-party content. Reacting to another *video* inline (duet/stitch) → `REACTION_STITCH`; commentating over a *static* artefact (article, screenshot, post) → `GREEN_SCREEN_COMMENTARY`.
- **`TEXT_SLIDESHOW` vs `CAROUSEL_STATIC`** — `CAROUSEL_STATIC` is reserved for a genuine multi-image carousel post with **no video content at all**; a video composed of text/image cards is `TEXT_SLIDESHOW`.

`ctaType` needs less discrimination work (the values are mostly distinguishable by the literal ask) but does need two things: Indonesian-localized example phrasings — `SHOP_PURCHASE` in particular must anchor on "keranjang kuning" / "checkout di keranjang", and `JOIN_COMMUNITY` on "gabung grup WA" — and instrumentation on **both** the `OTHER` rate **and** the `["NONE"]` rate.

**The `["NONE"]`-rate instrument is confirmed, and the rationale matters.** `OTHER`-rate instrumentation catches a taxonomy that is missing values; it cannot catch a model that is simply failing to *see* CTAs that are there. An implausibly high no-CTA rate is the only signal that stacked or soft CTAs are being under-detected — a CTA buried mid-video, or phrased obliquely ("cek keranjang ya"), silently lands as `["NONE"]` and looks like perfectly valid data. **Nothing else in the pipeline would surface it.** Track it alongside `OTHER` from day one.

### 4.4 Schema versioning

`result_content` gains a `schemaVersion` field (integer or semver string), absent today. Every future schema change increments it, so old and new rows are distinguishable and the UI/generator can branch on it if a hard cutover isn't clean.

### 4.5 Scorecard dimensions — redesigned [CONFIRMED]

This closes the last deferred item in this PRD. The owner has reviewed the 7 existing dimensions (`hookStrength`, `retentionFlow`, `visualPolish`, `audioVisualSync`, `trendAlignment`, `callToAction`, `brandConsistency`) and **replaced them**. Three are removed, three are added, one is renamed and rescoped, one is widened. The count stays at 7.

**Final 7 dimensions:** `hookStrength`, `retentionFlow`, `visualPolish`, `ctaEffectiveness`, `messageClarity`, `originality`, `emotionalResonance`.

#### Removed — three, and why

These were not merely weak metrics; they were **structurally broken** given what Gemini can actually observe. The reasoning is recorded so it isn't relitigated.

- **`brandConsistency` — REMOVED from the scorecard, MOVED to the style fingerprint (§6).** Consistency is by definition a property **across** videos. Gemini sees exactly one video, with no reference to the creator's other work, so it has nothing to be consistent *with* — it was fabricating a plausible-looking number. **This is the same class of error as the "Recurring Red Flags" mislabel (§2):** single-video commentary presented as a cross-post finding. It is not a bad metric, it was at the wrong level. As a **derived cross-corpus metric on the fingerprint** it is genuinely computable and genuinely meaningful ("this creator is stylistically scattered"). See §6.1.
- **`trendAlignment` — REMOVED outright, not relocated.** Gemini's training has a cutoff and **cannot know what is currently trending**. It would guess from stale knowledge, and there is no way for a reader to distinguish a real signal from a hallucination. For an agency making real decisions this is worse than absent — it is actively misleading. Unlike `brandConsistency` there is no level at which this becomes computable from the data we hold, so nothing is relocated.
- **`audioVisualSync` — REMOVED as a standalone dimension, FOLDED INTO `visualPolish`.** Too narrow to earn a seventh of the scorecard, and largely correlated with production quality anyway — a video with sloppy cuts is rarely otherwise polished, so it was mostly restating `visualPolish` and implying corroboration that wasn't there.

#### Kept — four, with changes

| Dimension | Change | Definition |
|---|---|---|
| `hookStrength` | Unchanged intent | How well the opening arrests the scroll. **The single most important short-form metric** — observable from the video, actionable, and directly imitable by the generator. |
| `retentionFlow` | Unchanged | Pacing and structure: does the video sustain attention through its middle, or does it sag? |
| `visualPolish` | **WIDENED** | Overall production craft. **Now explicitly absorbs `audioVisualSync`** — beat-matching, cut timing, and audio/visual coordination are scored here as part of production craft, alongside framing, lighting, stability, and editing quality. |
| `ctaEffectiveness` | **RENAMED** from `callToAction`, **RESCOPED** | **Execution quality of the ask, and nothing else.** *What* the ask is (`ctaType`) and *where* it lands (`ctaTiming`) are now captured **structurally** in Tier 1 (§4.3.6). This dimension must **not** duplicate them — it scores only how well the ask is delivered: is it clear, is it motivated by what preceded it, does it feel earned or bolted on. |

#### Added — three, and why

| Dimension | Definition | Why it earns a slot |
|---|---|---|
| `messageClarity` | Is there one clear takeaway, or does the video meander? | **The most common failure mode in creator content**, and highly actionable — "cut this to one idea" is advice an agency can act on immediately. |
| `originality` | Is the execution fresh, or generic/derivative? | **This is what an agency is actually paid for.** Judgeable from a single video against general format knowledge, so unlike `trendAlignment` it doesn't require knowing what is currently trending. |
| `emotionalResonance` | Does the video actually land emotionally? | Drives **shares and saves**, which matter more than raw views for reach. A technically competent video that lands flat is a real and diagnosable problem the old scorecard could not name. |

### 4.6 Score scale: 1–10 → 1–5 [CONFIRMED]

**All scorecard dimensions and `overallScore` move from a 1–10 scale to a 1–5 scale.**

**Rationale, recorded.** Gemini cannot reliably distinguish a 6 from a 7. That precision is **fictional**, and it materially contributes to the non-reproducibility problem §5 exists to solve — run the same video twice and the noise shows up in exactly those middle bands. A 5-point scale with anchored bands is **more honest, more consistent run-to-run, and loses nothing genuinely captured**. Ten points invites false precision, and that false precision does not stay contained: it propagates into the style fingerprint as noise.

This also makes the §5.3 rubric-anchoring work **materially more tractable** — writing five defensible band definitions per dimension is achievable; writing ten is not, which is part of why it was never done.

**Implementation impact — this is a schema change with a mandatory frontend companion.** Flagged here so it becomes a ticket rather than a surprise:

- `lib/server/analysis/prompts/system.ts` — the prompt currently specifies `number (1-10)` per dimension and must be rewritten for the new dimension set and the 1–5 scale.
- `lib/server/analysis/types/analysis.ts` — the scorecard type must be rewritten for the new dimension set.
- `lib/server/analysis/parser/validation.ts`, `app/api/analyses/route.ts`, `lib/api/analyses/types.ts` — all carry the old dimension list.
- **The UI's score colour thresholds break.** `AnalysisScorecardSection` currently colours green at `>= 7`, yellow at `>= 5`, red below. **On a 1–5 scale every score renders red or yellow** and the table looks broken. The same component's radial gauge divides by `10`. `AnalysisDataTable` also references the removed dimensions by name.
- **The frontend fix must ship WITH the schema change, not after it.**

---

## 5. Reproducibility fixes (confirmed in scope, owner: "same scope as 1.4 if possible")

1. `temperature: 0.2` → `0`.
2. Replace regex-scraping of JSON out of free text (`parser/analysis.ts`) with Gemini's structured output mode (`responseSchema` / `responseMimeType: "application/json"`), matching the schema in §4.
3. Add anchored rubric text per scorecard dimension — explicit definitions for **all five bands (1, 2, 3, 4, 5)** of the confirmed 1–5 scale (§4.6), for each of the seven confirmed dimensions (§4.5), not just a name and a one-line gloss. **Anchors are written for 5 bands, not 10** — the move off the 10-point scale is precisely what makes this tractable. Without this, scores aren't comparable across videos, which breaks the analysis feature's credibility and any "what works for this creator" reading of the scorecard. (Note: the fingerprint itself does **not** weight by performance — §6.1 — but comparable scores are still required for the scorecard to mean anything.)
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
- **`brandConsistency` lives here, as a derived cross-corpus metric.** Removed from the per-video scorecard (§4.5) because a single video has nothing to be consistent *with*. At the fingerprint level it is genuinely computable: it measures **how tightly clustered a creator's Tier 1 style attributes are across their analyzed videos** — how concentrated their `formatArchetype` / `hookType` / `ctaType` / `pacing` distributions are, and how stable their caption and verbal tone read. A creator who does the same thing recognizably every time scores high; one whose output is stylistically scattered scores low. Note this is **descriptive, not a quality judgement** — low consistency is not automatically bad, and the UI must not present it as a failing grade. It is also **not** a performance weight (see the bullet above): it describes the corpus, it does not re-rank it. Exact aggregation formula is a tech-lead design decision (§6.3).

### 6.2 (resolved — formerly "proposed, not yet owner-confirmed")

Everything previously listed here has been confirmed by the owner and folded into §6.1. Nothing in the style fingerprint scope remains open.

### 6.3 What the fingerprint needs to contain (derived from §4.1 Tier 1 fields, aggregated)

Aggregation logic (e.g. "most common hookType," "typical pacing," "representative onScreenText patterns," "typical CTA," "caption tone summary") is a technical design decision for the tech lead, not specified in detail here. Functionally, the fingerprint must be rich enough that a generator prompt can say "write this in @creator's style" and have something concrete to condition on — not just "this creator scores 4/5 on visualPolish."

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
- ~~Redefining the specific names/count of the 7 scorecard dimensions.~~ **NO LONGER OUT OF SCOPE.** Previously deferred; the owner has since reviewed and redesigned the dimension set, and confirmed the 1–5 scale. **In scope for this phase** — see §4.5 and §4.6.
- Full `profiles` module expansion (its own UI, full creator profile page) — owner has stated this is a future, separate module (Q2.7).

---

## 12. Open Questions

**All of the original open questions have now been closed by owner decision.** Nothing in this section remains open or deferred. The resolved items are recorded below so nobody re-opens them.

### Still open — do not invent answers

**Nothing.** Every question in this PRD has been closed by owner decision.

### Known future decision — not a blocker

**None remaining.** The scorecard-dimension review was the last item in this category and has now been resolved (see below). **§12 contains no open items and no deferred items.**

### Resolved by owner decision (formerly open)

- ~~**Enum identifier language.**~~ **CONFIRMED** exactly as §4.2 proposed: English machine-stable identifiers, Indonesian UI labels via lookup.
- ~~**Style fingerprint weighting.**~~ **CONFIRMED:** all analyzed videos count equally. No performance weighting of any kind (§6.1).
- ~~**Confidence UI.**~~ **CONFIRMED in scope for this phase** (§6.1).
- ~~**Cold-start threshold governance.**~~ **CONFIRMED:** stays at 5. No formal governance process and no defined metric — revisit informally once real output quality is observed. Deliberately not over-specified.
- ~~**Creator-vs-competitor UX.**~~ **Moot.** The distinction itself was removed (§8) — there is no flag to set, so there is no UX for setting it.
- ~~**`topicNiche` / `hookType` taxonomies.**~~ **CONFIRMED** — see §4.3.1 and §4.3.2.
- ~~**`formatArchetype` / `ctaType` taxonomies.**~~ **CONFIRMED** — see §4.3.6. Both draft value lists were **rejected and replaced**, not amended: `formatArchetype` is a 14-value + `OTHER` production-form enum, `ctaType` is an 11-value + `NONE` + `OTHER` enum **carried as an array**. Rejection rationale is recorded in §4.3.6 so it isn't relitigated. **All four taxonomies are now settled** — nothing in §4.3 is awaiting sign-off.
- ~~**`ctaTiming`.**~~ **CONFIRMED** — see §4.3.6. Previously carried here as a proposal awaiting a yes/no; the owner has since confirmed it. It is a Tier 1 field (`EARLY` / `MID` / `END` / `NONE`) capturing CTA placement, with a hard biconditional `NONE` consistency rule against `ctaType`.
- ~~**Prompt-engineering requirements for `formatArchetype` / `ctaType`.**~~ **CONFIRMED** — see §4.3.6. Previously a tech-lead recommendation. The owner approved both parts: the six `formatArchetype` discriminator rules, and instrumenting the `["NONE"]` rate alongside `OTHER`.
- ~~**Scorecard dimension review.**~~ **RESOLVED — this was the last deferred item in the PRD.** Formerly deferred on the grounds that the owner did not yet know what he needed. He has since reviewed the set and **replaced it**: `brandConsistency`, `trendAlignment` and `audioVisualSync` are removed (the first relocated to the fingerprint, §6.1; the second dropped outright; the third folded into `visualPolish`), `callToAction` is renamed to `ctaEffectiveness` and rescoped to execution quality only, and `messageClarity`, `originality` and `emotionalResonance` are added. Full reasoning in §4.5. **No longer out of scope, no longer deferred — in scope for this phase.**
- ~~**Score scale.**~~ **CONFIRMED:** 1–10 → **1–5**, for all scorecard dimensions and `overallScore` (§4.6). Ten points invited false precision Gemini cannot actually deliver, which fed directly into the reproducibility problem §5 exists to solve. Carries a mandatory frontend companion change — the existing colour thresholds break on a 1–5 scale (§4.6).

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
- `formatArchetype` is a confirmed 14-value + `OTHER` **production-form** taxonomy, orthogonal to `hookType` and `topicNiche` (§4.3.6).
- `ctaType` is a confirmed 11-value + `NONE` + `OTHER` taxonomy, and is an **array** — `NONE` must be the sole element, empty arrays are invalid, "no CTA" is `["NONE"]` (§4.3.6).
- `ctaTiming` is a confirmed Tier 1 enum (`EARLY` / `MID` / `END` / `NONE`) capturing **where** the CTA lands, distinct from `ctaType` (**what** the ask is). The two `NONE`s are **biconditional** — `ctaType: ["NONE"]` if and only if `ctaTiming: NONE`; any other pairing is invalid and must fail validation (§4.3.6).
- **All Tier 1 taxonomies (`topicNiche`, `hookType`, `formatArchetype`, `ctaType`, `ctaTiming`) are confirmed.** Nothing in this PRD is awaiting sign-off.
- **Scorecard redesigned (§4.5).** Final 7: `hookStrength`, `retentionFlow`, `visualPolish` (widened to absorb `audioVisualSync`), `ctaEffectiveness` (renamed from `callToAction`, rescoped to execution quality only), `messageClarity`, `originality`, `emotionalResonance`. Removed: `brandConsistency` (relocated to the fingerprint, §6.1), `trendAlignment` (dropped outright — Gemini cannot know current trends), `audioVisualSync` (folded into `visualPolish`).
- **Score scale is 1–5, not 1–10** — all scorecard dimensions and `overallScore` (§4.6). Rubric anchors are written for 5 bands (§5.3). **The UI colour thresholds must be fixed in the same ship** or every score renders red/yellow.
- `brandConsistency` is a **fingerprint-level derived cross-corpus metric** (§6.1), descriptive rather than a quality judgement, and not a performance weight.
- Prompt requirements: Indonesian-localized few-shot examples, explicit discriminator rules for the `hookType` collision pairs (§4.3.5) **and the six `formatArchetype` pairs** (§4.3.6), `OTHER`-rate instrumentation, **and `["NONE"]`-rate instrumentation on `ctaType`** (§4.3.6).
- No real migration burden; schema can be replaced outright; avoid running new analyses under the old schema during the transition.
- Auth, job queue, bulk ingestion, generator UI, longitudinal snapshots, monetization, and full profile module are explicitly out of scope for this PRD.

**Still awaiting sign-off:**
- **Nothing.** There is no unapproved field or taxonomy left in this PRD.

**Proposed by the tech lead, not owner-approved** [RECOMMENDATION]:
- **Nothing.** The two outstanding recommendations — the `formatArchetype` discriminator rules and `["NONE"]`-rate instrumentation — have both been approved by the owner and promoted to [CONFIRMED] in §4.3.6.

**Known future decision, not blocking:**
- **None.** The scorecard-dimension review was the last item here and is now resolved (§4.5, §4.6).

**There are no remaining PRD-level open items.** §12 is empty of both open questions and deferred decisions. Every field, taxonomy, dimension and scale in this document is owner-confirmed and ready for technical design.

**One implementation hazard to carry into the TDD, not an open decision:** the 1–5 scale change (§4.6) breaks the existing UI score colour thresholds and radial gauge. Backend schema and frontend rendering must ship together.
