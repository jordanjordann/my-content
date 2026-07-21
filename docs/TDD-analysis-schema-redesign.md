# TDD — Analysis Output Schema Redesign (Phase 2)

**Status:** Ready for dev handoff
**Author:** John (tech lead)
**Created:** 2026-07-22
**Source of truth:** `docs/PRD-analysis-schema-redesign.md` (all fields, taxonomies, dimensions and the 1–5 scale are owner-confirmed there — §12 is empty of open items).
**Roadmap context:** `docs/product-direction-plan.md` §3 Phase 2.

Reading conventions:

- **[PRD]** — settled by the PRD. Not a design decision. Do not relitigate.
- **[TL]** — a technical design decision made in this document, within the latitude the PRD grants (§6.3 explicitly delegates aggregation design to the tech lead). Implementers build to it; if it proves wrong during implementation, raise it, don't silently deviate.
- **[VERIFY]** — genuinely uncertain, must be established empirically during implementation before the surrounding code is trusted.
- **[NEEDS OWNER DECISION]** — a gap the PRD does not close. A recommended default is given so work is not blocked, but the owner must confirm.

---

## 0. Scope in one paragraph

Replace the analysis output contract end to end: a two-tier `result_content` (structured Tier 1 style attributes + a reworked 7-dimension 1–5 scorecard), produced via Gemini structured output rather than regex-scraped prose, validated loudly rather than fabricated, versioned, rendered correctly by a frontend that ships in the same batch, generalised to N-media-part carousels, and aggregated into a new persisted style fingerprint. No data migration — 2 rows in `analyses`, 1 in `profiles`.

---

## 1. Current state, verified against the code

Read before designing anything. Line counts and behaviours below were checked against `origin/main` at `382bdf3`.

| File | Current behaviour | Why it matters |
|---|---|---|
| `lib/server/analysis/prompts/system.ts` | 61 lines. Hardcodes the old 7 dimensions, `1-10`, and a hand-written "Respond with ONLY valid JSON" block. No rubrics. | Full rewrite. |
| `lib/server/analysis/gemini/generate.ts` | `temperature: 0.2`, `maxOutputTokens: 8192`, no `responseMimeType`, no `responseSchema`. Takes a single `fileUri: string \| null`. | Config change **and** signature change for carousels. |
| `lib/server/analysis/parser/analysis.ts` | `extractJson()` regex-scrapes a ```json fence or first-brace-to-last-brace, then coerces every field with a silent default (`overallScore` → `0`). | Deleted, replaced by strict parse. |
| `lib/server/analysis/parser/validation.ts` | `SCORECARD_KEYS` hardcodes the old 7. Missing key → `5`. Missing object → all-5s. `clampScore` clamps to 1–10. | **This is the fabrication bug.** Rewritten to assert-or-throw. |
| `lib/server/analysis/types/analysis.ts` | 32 lines. `Scorecard` (old 7), `Patterns` (3 prose arrays), `ContentAnalysis`. | Full rewrite. |
| `lib/api/analyses/types.ts` | Duplicates `Scorecard`/`Patterns`/`ContentAnalysis` for the client. | Must move in lockstep with the server type. |
| `app/api/analyses/route.ts` | Lines 25–36 inline a **third** copy of the old dimension list inside a `JSON.parse` cast. | Third drift site. Fixed by importing the shared type. |
| `app/app/analyses/.../AnalysisScorecardSection.tsx` | `DIMENSIONS` array (old 7 + English labels); `getScoreColor` thresholds `>=7` green / `>=5` yellow; `strokeDasharray={(overallScore / 10) * 327}`; `(score / 10) * 163`; literal `/ 10` label. | **Breaks visibly on a 1–5 scale.** Four separate places. |
| `app/app/analyses/.../AnalysisDataTable.tsx` | Its own `getScoreColor`/`getScoreBg` with the same `>=7`/`>=5` thresholds; seven `<DimensionScoreCell score={analysis.scorecard?.X}>` referencing removed dimensions by name; column headers "A/V", "Trend", "Brand"; `colSpan={12}`. | Second, independent copy of the threshold logic. |
| `app/app/analyses/.../AnalysisPatternsSection.tsx` | Renders `patterns.viralFormulas` / `audiencePsychology` / `recurringRedFlags`. | Two of three fields cease to exist. |
| `lib/server/analysis/fetcher/adapter.ts` | `resolveVideoChild()` returns the **first** video slide only; `durationSec`, audio and `videoUrl` all sourced from that one node. | Generalised to N parts. |
| `lib/server/analysis/downloader/download.ts` | `downloadVideo(url)` → one file, `MAX_VIDEO_BYTES` cap, SSRF-guarded. | Generalised to N parts with a total cap. |
| `lib/server/analysis/gemini/upload.ts` | `uploadToGemini(filePath)` → one URI; `getMimeType` handles mp4/mov/webm only. | Needs image mime types. |
| `lib/server/analysis/pipeline/index.ts` | 291 lines. Single `fileUri`, single `videoPath`, `analysis_mode` binary. | Rewired. |
| `migrations/006` | `analysis_mode TEXT CHECK(analysis_mode IN ('full_video','metadata_only'))`. | The CHECK blocks a third mode (§7.4). |
| **Tests** | **Zero test files. No test runner in `package.json`. `.claude/context/verified-facts.md` does not exist.** | See §9. |

**One correction to the brief's blast-radius list, found during this review:** it is **seven** files carrying the old dimension list or the 1–10 assumption, not five. `app/app/analyses/components/sections/types.ts` (`ScorecardSectionProps`/`PatternsSectionProps`) and `AnalysisPatternsSection.tsx` are also load-bearing, and `AnalysisDataTable.tsx` holds a **second independent copy** of the colour thresholds — fixing `AnalysisScorecardSection` alone leaves the table wrong.

---

## 2. Architecture

### 2.1 Layering — unchanged

`classifier → fetcher → adapter → pipeline → gemini → parser → persist` stays exactly as it is. Per `product-direction-plan.md` §2, the plumbing is good and the contract is wrong. **Nothing in this TDD is a rewrite of a pipeline stage.** Everything is either a new leaf module, a replacement of a leaf's contents, or a widening of a stage's input arity (one media part → N).

### 2.2 New modules and where they live

Three new modules. Placement matters, because two of them are consumed by **both** server and client and the repo currently solves that by copy-pasting types (three copies of `Scorecard` today — that is exactly how `app/api/analyses/route.ts` ended up with its own inline dimension list).

```
lib/analysis/taxonomy/               # NEW — ISOMORPHIC. Imported by server AND client.
├── index.ts                         # Barrel
├── types.ts                         # TopicNiche, HookType, FormatArchetype, CtaType, CtaTiming, BeatType, Pacing
├── constants.ts                     # The value arrays (single source for enum + responseSchema + FE labels)
├── labels.ts                        # Indonesian UI label lookups, per PRD §4.2
└── helpers.ts                       # isTopicNiche(x), assertCtaTypeArray(x), etc. — pure guards

lib/server/analysis/schema/          # NEW — server-only. Gemini structured-output schema.
├── index.ts
├── responseSchema.ts                # Built FROM lib/analysis/taxonomy/constants.ts — never a second literal list
└── constants.ts                     # ANALYSIS_SCHEMA_VERSION

lib/server/analysis/media/           # NEW — server-only. Carousel N-part resolution.
├── index.ts
├── types.ts                         # MediaPart
├── resolveMediaParts.ts             # ScrapeCreators payload -> MediaPart[]
├── prepareParts.ts                  # MediaPart[] -> Gemini Part[] (download/upload/inline)
└── constants.ts                     # MAX_MEDIA_PARTS, MAX_TOTAL_MEDIA_BYTES

lib/server/fingerprint/              # NEW — server-only. Style fingerprint. Mirrors lib/server/profiles/.
├── index.ts
├── types.ts
├── constants.ts                     # FINGERPRINT_VERSION, MIN_ANALYSES_FOR_FINGERPRINT = 5
├── aggregate.ts                     # PURE. AnalysisTier1[] -> ComputedFingerprint. No I/O, no LLM.
├── repository.ts                    # SQL only
└── service.ts                       # orchestration + override merge
```

**[TL] Why `lib/analysis/taxonomy/` sits at `lib/` root, not under `lib/server/`.** The enum identifiers are English and machine-stable [PRD §4.2] but the UI renders Indonesian labels — so both tiers need the same value list. The repo's existing convention (`lib/server/*` server, `lib/api/*` client) has no isomorphic home, and the consequence is visible: `Scorecard` is declared three times today and `app/api/analyses/route.ts` already drifted into a fourth inline copy. A 17-value + 14-value + 11-value + 18-value taxonomy duplicated across the boundary is a certainty of drift, not a risk of it. The module is pure constants and type guards with zero imports, so it is safe on both sides.

**Hard rule for implementers: `responseSchema.ts`, the prompt's taxonomy block, the validators and the FE label lookups must all derive from `lib/analysis/taxonomy/constants.ts`.** If any of them contains its own literal list of enum values, the ticket is not done. This is the single most important structural constraint in this TDD.

### 2.3 Existing modules rewritten in place

`prompts/`, `parser/`, `types/analysis.ts`, `gemini/generate.ts` — same paths, new contents. `prompts/` gains two files:

```
lib/server/analysis/prompts/
├── system.ts                        # REWRITTEN — assembles the instruction from the parts below
├── rubrics.ts                       # NEW — 7 dimensions x 5 anchored bands (PRD §5.3)
├── taxonomyPrompt.ts                # NEW — definitions, Indonesian few-shots, discriminator rules (PRD §4.3.5, §4.3.6)
├── user.ts                          # MODIFIED — carousel slide manifest (§7.5)
└── helpers.ts                       # unchanged
```

---

## 3. Type definitions

### 3.1 `lib/analysis/taxonomy/types.ts`

```ts
export type TopicNiche =
  | "FOOD_CULINARY" | "BEAUTY_SKINCARE" | "FASHION_STYLE" | "HEALTH_FITNESS"
  | "FINANCE_INVESTING" | "BUSINESS_ENTREPRENEURSHIP" | "EDUCATION_SKILLS"
  | "TECH_GADGETS" | "PARENTING_FAMILY" | "RELIGION_SPIRITUALITY" | "TRAVEL"
  | "COMEDY_ENTERTAINMENT" | "LIFESTYLE_DAILY" | "HOME_INTERIOR" | "AUTOMOTIVE"
  | "GAMING" | "RELATIONSHIPS" | "OTHER";                                   // 18, PRD §4.3.1

export type HookType =
  | "DIRECT_VALUE_PROMISE" | "NUMBERED_LIST" | "CURIOSITY_QUESTION"
  | "SIDE_BY_SIDE_COMPARISON" | "MYTH_CORRECTION" | "WARNING_MISTAKE"
  | "CONTRARIAN_OPINION" | "SECRET_INSIDER_REVEAL" | "RESULT_PROOF"
  | "PERSONAL_STORY_OPENER" | "PROCESS_JOURNEY_SERIES" | "VISUAL_DEMONSTRATION"
  | "SHOCK_STATEMENT" | "RELATABLE_PAIN_POINT" | "EXPERIMENT_CHALLENGE"
  | "TEXT_OVERLAY_ONLY" | "COLD_OPEN_ACTION" | "OTHER";                     // 17 + OTHER, PRD §4.3.2

export type FormatArchetype =
  | "TALKING_HEAD" | "VOICEOVER_BROLL" | "POV_SKIT" | "TUTORIAL_DEMO"
  | "PRODUCT_REVIEW" | "TRANSFORMATION_REVEAL" | "GREEN_SCREEN_COMMENTARY"
  | "REACTION_STITCH" | "INTERVIEW_STREET" | "TEXT_SLIDESHOW" | "VLOG_DAILY"
  | "PROCESS_ASMR" | "PERFORMANCE" | "CAROUSEL_STATIC" | "OTHER";           // 14 + OTHER, PRD §4.3.6

export type CtaType =
  | "FOLLOW" | "COMMENT_PROMPT" | "SAVE_PROMPT" | "SHARE_PROMPT" | "LINK_IN_BIO"
  | "SHOP_PURCHASE" | "DM_INQUIRY" | "JOIN_COMMUNITY" | "SIGN_UP_REGISTER"
  | "WATCH_NEXT" | "DISCOUNT_CODE" | "NONE" | "OTHER";                      // 11 + NONE + OTHER, PRD §4.3.6

export type CtaTiming = "EARLY" | "MID" | "END" | "NONE";                   // PRD §4.3.6
export type BeatType  = "HOOK" | "SETUP" | "BODY_PROOF" | "TWIST" | "RESOLUTION" | "CTA";  // PRD §4.1
export type Pacing    = "SLOW" | "MEDIUM" | "FAST" | "MIXED";               // PRD §4.1
```

**[TL] `BeatType` and `Pacing` are uppercased** to match every other identifier in the contract. The PRD writes them lowercase in prose (`hook, setup, …`, `slow / medium / fast / mixed`) but only as descriptive text, not as a specified wire format; §4.2's confirmed rule is "stable English machine identifiers", and mixing cases across one JSON document is a needless source of comparison bugs.

### 3.2 `lib/server/analysis/types/analysis.ts` — the new contract

```ts
import type {
  TopicNiche, HookType, FormatArchetype, CtaType, CtaTiming, BeatType, Pacing,
} from "@/lib/analysis/taxonomy";

export interface StructureBeat {
  timestampSec: number;
  beatType: BeatType;
  description: string;          // Indonesian
}

/** Tier 1 — style attributes. The primary payload. PRD §4.1. */
export interface StyleAttributes {
  topicNiche: TopicNiche;
  topicSubtopic: string;               // Indonesian free text
  formatArchetype: FormatArchetype;
  hookType: HookType;
  hookTypeSecondary: HookType | null;  // see §4.3 for the wire representation
  hasAudienceCallout: boolean;
  hookText: string;                    // Indonesian, verbatim
  structureBeatMap: StructureBeat[];
  pacing: Pacing;
  estimatedCutsPerMinute: number | null;
  ctaType: CtaType[];                  // never empty; ["NONE"] means no CTA
  ctaTiming: CtaTiming;
  onScreenText: string[];              // Indonesian, verbatim, in order
  captionStyleNotes: string;           // Indonesian prose
  verbalTonePatterns: string[];        // Indonesian short tags
}

/** Tier 2 — 7 dimensions, each 1–5. PRD §4.5, §4.6. */
export interface Scorecard {
  hookStrength: number;
  retentionFlow: number;
  visualPolish: number;        // widened: absorbs the removed audioVisualSync
  ctaEffectiveness: number;    // renamed from callToAction, rescoped to execution quality only
  messageClarity: number;
  originality: number;
  emotionalResonance: number;
}

export interface ContentAnalysis {
  schemaVersion: number;       // PRD §4.4
  style: StyleAttributes;
  overallScore: number;        // 1–5
  scorecard: Scorecard;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  keyMoments: string[];
  redFlags: string[];          // renamed from patterns.recurringRedFlags
  suggestions: string[];
}
```

`Patterns` is **deleted**. `viralFormulas` and `audiencePsychology` do not survive in any form [PRD §4.1] — they decompose into Tier 1 fields.

`lib/api/analyses/types.ts` mirrors `ContentAnalysis` exactly. **[TL]** It re-exports the taxonomy types from `lib/analysis/taxonomy` rather than restating them, and `app/api/analyses/route.ts` imports `ContentAnalysis` instead of its current inline cast — that removes the third and fourth copies permanently.

`estimatedCutsPerMinute` is lifted out of a nested `pacing` object and sits flat alongside `pacing`. **[TL]** The PRD describes it as an optional companion to `pacing`; a flat nullable number is simpler to express in `responseSchema`, simpler to aggregate, and avoids an object that is sometimes half-present.

### 3.3 Schema version

`ANALYSIS_SCHEMA_VERSION = 2` in `lib/server/analysis/schema/constants.ts`. **[TL]** An integer, not semver — the PRD permits either (§4.4) and there is no consumer that would branch on a minor/patch distinction. Version `1` is retroactively "the pre-redesign contract"; the 2 existing rows have no `schemaVersion` key, and `schemaVersion === undefined` is therefore readable as version 1 without a backfill.

The version is written in **two** places, deliberately:

- inside `result_content` JSON as `schemaVersion` — travels with the document, survives export;
- as a new indexed column `analyses.schema_version INTEGER` — **[TL]** so the fingerprint can filter its source corpus with a plain indexed `WHERE`, rather than `json_extract` on every row. This matters because §6 must never aggregate mixed-contract rows.

---

## 4. Structured output — replacing the regex scraper

### 4.1 Why the current parser must go

`extractJson()` takes the first `{` to the last `}` of a free-text response and hopes. It succeeds often enough to look fine and fails silently into `validation.ts`, which fills the gaps with `5`. On the confirmed 1–5 scale that fabricated `5` reads as a **perfect** score [PRD §2, §5.4], and §6 aggregates these rows into the creator's fingerprint — so a single silent parse failure does not stay local, it poisons the creator's style profile with a bogus perfect-scoring exemplar. This is the most urgent single fix in Phase 2 and it is sequenced first among the parser work accordingly.

### 4.2 New `generate.ts` configuration

```ts
generationConfig: {
  temperature: 0,                              // PRD §5.1
  responseMimeType: "application/json",        // PRD §5.2
  responseSchema: ANALYSIS_RESPONSE_SCHEMA,    // PRD §5.2
  maxOutputTokens: 32768,                      // raised from 8192 — see below
}
```

**[VERIFY] Two things must be established empirically before this is trusted, in the very first backend ticket that touches Gemini:**

1. **`@google/generative-ai@^0.24.1` is the deprecated legacy SDK.** It does expose `responseSchema` via `generationConfig` with `SchemaType` — but the legacy `Schema` type does **not** support `propertyOrdering`, and its `nullable` handling on enum-typed properties is not something to take on faith. `node_modules/` is not installed in this worktree, so this was **not** verifiable at design time. The implementer must confirm against the actual installed typings and one live call with the full schema. **If `responseSchema` cannot express this contract on 0.24.1, stop and raise it — do not fall back to prose-plus-regex.** The escalation path is a migration to `@google/genai`, which is a scope change requiring an owner decision, not something to absorb quietly inside a ticket.
2. **`maxOutputTokens: 8192` is very likely too small now.** The new contract asks for `structureBeatMap`, `onScreenText[]`, `verbalTonePatterns[]`, `captionStyleNotes` and six prose arrays in one document, and `gemini-2.5-flash` spends output-token budget on thinking before it emits anything. A truncated response under structured output mode is a hard parse failure, which under §5.4 now correctly fails the analysis — meaning an under-sized budget presents as a mysterious wave of failed analyses. Raise it and confirm the real headroom on a long carousel.

Everything else in `generate.ts` (the parts array assembly) changes for carousels — see §7.

### 4.3 Nullable enums on the wire — `hookTypeSecondary`

**[TL]** `hookTypeSecondary` is `HookType | null` in the domain type [PRD §4.3.4: "optional/nullable"], but the **wire representation is a required, non-nullable enum with a `"NONE"` member**, normalised to `null` by the parser at the boundary.

Rationale, and it is the PRD's own: §4.3.6 chose `["NONE"]` over an empty array for `ctaType` explicitly so that *"the model found nothing"* and *"the model failed to populate the field"* are not the same value on the wire. The identical argument applies here — an absent or null `hookTypeSecondary` is ambiguous between "this hook genuinely carries one strategy" and "the field didn't get filled", and only the first is valid data. Making it explicit also sidesteps the [VERIFY] risk on nullable-enum support in the legacy SDK. `"NONE"` is added to the **wire** enum only; it is not a `HookType` and never reaches the domain type or the fingerprint.

`estimatedCutsPerMinute` stays a genuine nullable number (`nullable: true`), since "not derivable from this footage" is a real state and there is no sentinel number that isn't a lie. **[VERIFY]** confirm nullable numerics survive structured output; if not, use `-1` as the wire sentinel and normalise in the parser, applying the same reasoning as above.

### 4.4 New `parser/analysis.ts`

Under `responseMimeType: "application/json"` the response body is JSON, full stop. The parser becomes:

1. `JSON.parse(text)` — no fence stripping, no brace hunting. A `SyntaxError` here is a **thrown error**, not a recovery path. `extractJson()` is deleted.
2. Hand to `validation.ts`, which returns a `ContentAnalysis` or throws.
3. Stamp `schemaVersion: ANALYSIS_SCHEMA_VERSION`. **[TL]** Stamped server-side, not requested from the model — the model has no business asserting which contract it was run under, and a model-supplied version could silently disagree with the code that parsed it.

### 4.5 New `parser/validation.ts` — loud, not inventive

Every function is `assertX(raw): X` — returns the typed value or throws a `AnalysisValidationError` carrying a field path. **No defaults, no clamping-into-range, no `?? 5`, no `createDefaultScorecard()`.** The whole file's current behaviour is the bug.

Checks, in order:

| Check | Failure |
|---|---|
| Every one of the 7 scorecard keys present and a number | throw `scorecard.<key> missing or not a number` |
| Every score an integer in `[1,5]` | throw. **Do not clamp.** A 7 means the model ignored the scale and the run is untrustworthy, not roundable |
| `overallScore` integer in `[1,5]` | throw |
| `style.topicNiche` / `hookType` / `formatArchetype` / `ctaTiming` / `pacing` are members of their taxonomy | throw with the offending value |
| `style.ctaType` is a non-empty array of `CtaType`, no duplicates | throw. Empty array is invalid [PRD §4.3.6] |
| If `ctaType` contains `NONE`, it is the sole element | throw [PRD §4.3.6] |
| **Biconditional:** `ctaType` is `["NONE"]` **iff** `ctaTiming` is `NONE` | throw. **Never coerce or repair** [PRD §4.3.6] |
| `structureBeatMap` entries have numeric `timestampSec`, valid `beatType`, non-empty `description` | throw |
| `hasAudienceCallout` is a boolean | throw. Not truthy-coerced |
| Prose arrays are arrays of strings | throw if the container is missing; an empty array is legal |

A throw propagates to `runAnalysis`'s existing catch, which already marks `status = 'failed'` on re-analysis and deletes the row on first run. **The owner should expect previously-invisible failures to start surfacing. That is the intended effect** [PRD §5.4], and it is worth saying so in the release note rather than letting it read as a regression.

### 4.6 Instrumentation — `OTHER` and `["NONE"]` rates

[PRD §4.3.5, §4.3.6] mandate tracking the `OTHER` rate (target <10%, revisit at ~15%) on `hookType`/`formatArchetype`/`topicNiche` and the `["NONE"]` rate on `ctaType`.

**[TL]** Phase 2 implements this as **structured logging at parse time plus a SQL-queryable source**, not a dashboard. One `console.info("[TAXONOMY]", { … })` line per completed analysis carrying the classified values, and — because `analyses.result_content` is JSON in SQLite — the rates are directly queryable:

```sql
SELECT json_extract(result_content,'$.style.hookType') AS v, COUNT(*)
FROM analyses WHERE status='completed' AND schema_version = 2 GROUP BY v;
```

A UI for this is out of scope; the PRD asks that the rate not be *suppressed or hidden*, not that it be charted. Recording the query in the ticket satisfies that at negligible cost. Revisit when there is a corpus large enough for the rate to mean anything.

---

## 5. Prompt design

### 5.1 `rubrics.ts`

A `Record<keyof Scorecard, [string, string, string, string, string]>` — seven dimensions × five band definitions, Indonesian, one sentence each, describing **observable properties** rather than adjectives ("hook menyebutkan manfaat konkret dalam 2 detik pertama", not "hook yang baik"). Rendered into the system instruction by `system.ts`.

The typed tuple is deliberate: adding a dimension without writing five bands must be a **compile error**. Under-specified rubrics are how the current prompt ended up with a name-and-a-gloss and non-comparable scores.

`visualPolish`'s bands must explicitly mention beat-matching and cut timing, since it absorbed `audioVisualSync` [PRD §4.5]. `ctaEffectiveness`'s bands must score **only delivery quality** and must not mention which CTA it is or where it lands — those are `ctaType`/`ctaTiming` and duplicating them re-creates the correlated-dimension problem the PRD removed `audioVisualSync` to avoid.

### 5.2 `taxonomyPrompt.ts`

Generated from `lib/analysis/taxonomy/constants.ts`. For each enum: identifier, Indonesian definition, and **Indonesian-localised few-shot examples** [PRD §4.3.5 — the PDF's American examples must be translated, and Gemini must anchor on rhetorical strategy, not US subject matter].

Discriminator rules, verbatim from the PRD, are non-negotiable prompt content:

- `hookType` (§4.3.5): `VISUAL_DEMONSTRATION` vs `SIDE_BY_SIDE_COMPARISON`; `MYTH_CORRECTION` vs `CONTRARIAN_OPINION`.
- `formatArchetype` (§4.3.6), all six: `VOICEOVER_BROLL`/`PROCESS_ASMR`, `TUTORIAL_DEMO`/`PRODUCT_REVIEW`, `POV_SKIT`/`PERFORMANCE`, `TALKING_HEAD`/`GREEN_SCREEN_COMMENTARY`, `REACTION_STITCH`/`GREEN_SCREEN_COMMENTARY`, `TEXT_SLIDESHOW`/`CAROUSEL_STATIC`.
- `ctaType`: `SHOP_PURCHASE` anchored on "keranjang kuning" / "checkout di keranjang"; `JOIN_COMMUNITY` on "gabung grup WA".
- `hasAudienceCallout`: stated as **orthogonal** to `hookType` — "Buat kamu yang…" sets the boolean and does **not** constrain the hook label [PRD §4.3.3].
- The `ctaType`/`ctaTiming` biconditional stated as a hard rule in the prompt as well as enforced in validation. Belt and braces: the schema cannot express it, so the prompt is the only place it can be *prevented* rather than merely *caught*.

**Do not** put the Indonesian cultural caveat about `CONTRARIAN_OPINION` under-firing (§4.3.5) into the prompt. It is an instruction to *us* about reading the output, not to the model; telling the model to expect a low rate would bias it toward producing one. It belongs in the ticket body and in this TDD, which is where it now is.

### 5.3 `system.ts`

Reduced to assembly: role framing + rubric block + taxonomy block + output-language rule. **The hand-written JSON shape block at the bottom of the current file is deleted** — `responseSchema` now carries the shape, and keeping a prose copy guarantees the two disagree eventually. Retain only the "Gunakan BAHASA INDONESIA untuk semua teks bebas; identifier enum tetap dalam bahasa Inggris" instruction, which the schema cannot express.

---

## 6. Style fingerprint

### 6.1 Storage — new table, migration 009

Separate from `profiles`, per [PRD §6.1] and the owner's stated reason (`profiles` holds scraped facts; this holds inference; mixing them is the nullable-boolean coercion bug pattern).

```sql
CREATE TABLE profile_style_fingerprints (
  id                  TEXT PRIMARY KEY,
  profile_id          TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fingerprint_version INTEGER NOT NULL,   -- of the AGGREGATION ALGORITHM
  schema_version      INTEGER NOT NULL,   -- of the source analyses
  sample_size         INTEGER NOT NULL,   -- the "based on N videos" number
  source_analysis_ids TEXT NOT NULL,      -- JSON array; makes a fingerprint auditable
  computed            TEXT NOT NULL,      -- JSON: machine-derived aggregate
  overrides           TEXT,               -- JSON: human corrections. NEVER overwritten by recompute
  consistency_index   REAL,               -- brandConsistency, 0..1. See §6.4
  computed_at         TEXT NOT NULL DEFAULT (datetime('now')),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_fingerprints_profile ON profile_style_fingerprints(profile_id);
```

**[TL] `computed` and `overrides` are two separate columns, and this is the load-bearing decision in the whole module.** The PRD requires the fingerprint to be both *recomputed as new analyses land* and *human-editable, with corrections improving future generations* (§6.1). A single merged blob cannot satisfy both: the next recompute would silently destroy the agency's corrections, which is precisely the "unknown silently became a wrong concrete value" failure class the owner named as the thing to avoid. Storing them apart and merging at read time (`getFingerprint()` returns `{...computed, ...overrides}` per top-level key, plus an `overriddenKeys: string[]` so the UI can mark which fields are human-set) makes recompute idempotent with respect to human input.

**[TL] `fingerprint_version` is separate from `schema_version`.** The aggregation algorithm and the analysis contract version independently — changing how "typical pacing" is computed does not invalidate the source analyses, and vice versa. One column conflating both would force a needless full recompute on either kind of change.

**[TL] No `is_stale` flag.** `sample_size` + `source_analysis_ids` already answer "is this current?" by comparison against the live analysis count. A denormalised flag is a second source of truth that can only ever be wrong.

### 6.2 Trigger and cold start

- Recompute at the end of `runAnalysis`, after the result is persisted, **inside a try/catch that logs and swallows** — exactly the convention `resolveProfile` already uses in `pipeline/index.ts` (a profile failure must never fail an analysis). A fingerprint failure must never fail an analysis either.
- Guard: `MIN_ANALYSES_FOR_FINGERPRINT = 5` [PRD §6.1, stays at 5]. Below 5 completed, current-schema analyses for the profile, **no row is written at all** — not a row with a low-confidence flag. Absence is unambiguous.
- **[TL]** `MIN_ANALYSES_FOR_FINGERPRINT` lives in `constants.ts`, not inline. The plan (§1) recommends treating 5 as tunable; the PRD says do not over-specify governance. A named constant satisfies both — it is one edit to change and carries no process.
- **[TL] Aggregation is pure TypeScript. No LLM call.** It is deterministic, free, instant, and re-runnable on every analysis. An LLM-summarised fingerprint would be non-reproducible, which is the exact defect §5 exists to eliminate; introducing it at the aggregation layer would undo the reproducibility work one level up.

### 6.3 What `aggregate.ts` computes

Input: `StyleAttributes[]` (+ each analysis's id and date). Output `ComputedFingerprint`. **All videos weighted equally — no `overallScore` weighting, no scorecard weighting** [PRD §6.1, confirmed and explicit].

| Field | Derivation |
|---|---|
| `topicNiches` | Full frequency distribution `{value, count, share}[]`, descending. Not just the mode — an agency needs the spread |
| `topicSubtopics` | Verbatim strings, most frequent first. Free text; no clustering in Phase 2 |
| `formatArchetypes` | Frequency distribution |
| `hookTypes` | Frequency distribution over primary **and** secondary, secondary counted at equal weight. **[TL]** The PRD's reason for capturing a secondary is that ~13% of hooks genuinely carry two (§4.3.4); discarding it in the aggregate would waste the field |
| `audienceCalloutRate` | Share of videos with `hasAudienceCallout === true` |
| `typicalPacing` | Modal `Pacing` + the distribution |
| `medianCutsPerMinute` | Median of non-null `estimatedCutsPerMinute`. **[TL]** Median, not mean — one 90-cut montage should not drag a talking-head creator's profile |
| `ctaTypes` | Frequency over the flattened multiset of all arrays. `NONE` counted as a value |
| `ctaTimings` | Frequency distribution |
| `typicalBeatSequence` | Most frequent ordered `beatType` sequence, plus the median beat count |
| `verbalTonePatterns` | Tags normalised (trim + lowercase) and ranked by frequency; top N with counts |
| `captionStyleExemplars` | **[TL]** The `captionStyleNotes` strings verbatim from the N most recent analyses, not a synthesised summary. Satisfies "must include caption/text style" (§6.1) without an LLM call, and gives the generator concrete text to condition on rather than a lossy paraphrase |
| `hookTextExemplars` | Verbatim `hookText` from the corpus. Same reasoning — the generator imitating a creator's hooks wants the actual hooks |
| `onScreenTextExemplars` | Verbatim samples |
| `sampleSize`, `sourceAnalysisIds`, `dateRange` | Provenance |

This satisfies [PRD §6.3]: a generator prompt can be handed real hooks, real caption voice, a modal format and a characteristic CTA placement — concrete material, not "scores 4/5 on visualPolish".

**[TL] No Tier 1 values are promoted to `analyses` columns.** The corpus is dozens of rows; `json_extract` over `result_content` is entirely adequate, and denormalised enum columns would be a second copy to keep in sync. Revisit only if a query becomes slow — it will not at this scale.

### 6.4 `brandConsistency` — the relocated cross-corpus metric

[PRD §6.1] relocates it here and delegates the formula to the tech lead.

**[TL] Definition.** For each of four categorical dimensions — `formatArchetype`, `hookType` (primary), `ctaType` (flattened multiset), `pacing` — compute the normalised Simpson concentration index over the observed distribution:

```
C_d = (Σ p_i² − 1/k) / (1 − 1/k)      where p_i = share of value i, k = number of distinct values observed
C_d = 1 when only one value was ever observed
consistencyIndex = mean(C_format, C_hook, C_cta, C_pacing)   // equal weights, per §6.1
```

**Why Simpson rather than "share of the modal value":** modal share is blind to the shape of the tail — a creator split 50/50 between two formats and one split 50/10/10/10/10/10 both score 0.5 on modal share, but the first is recognisably consistent and the second is scattered. Simpson separates them. Normalising by `1/k` keeps the index comparable across dimensions with different observed cardinalities.

**Presentation constraints, carried from [PRD §6.1] and binding on whoever builds the UI:**

- It is **descriptive, not a quality judgement**. Low consistency is not a failing grade and must not be coloured or worded as one. **[TL]** Specifically: do **not** render it on the same 1–5 scorecard scale or with the scorecard's red/yellow/green ramp. It is a `0..1` index shown neutrally with an explanatory label. Reusing the scorecard's visual language would re-create, at the fingerprint level, exactly the misreading the PRD removed it from the scorecard to prevent.
- It is **not** a weight. It describes the corpus; it never re-ranks it. Nothing in `aggregate.ts` may consume `consistencyIndex`.

**[NEEDS OWNER DECISION — low urgency, does not block Phase 2.]** Whether the four dimensions stay equally weighted in `consistencyIndex`. §6.1's "equal weighting" confirmation is about *videos* in the aggregate, which is unambiguous; it does not obviously extend to *dimensions* inside this derived index. Equal weighting is the recommended default and what the tickets specify — flagging it only so nobody later claims the owner confirmed it.

### 6.5 Confidence indicator — a genuine PRD gap

[PRD §6.1] puts the "based on N videos" indicator **in scope for this phase**, "on the generation surface and on the profile page".

**Neither surface exists.** There is no profile page (`profiles` module UI is Phase 5 per the plan) and no generation surface (the generator feature is explicitly out of scope, PRD §11), and the plan's [OPEN 2] — where generation lives in the IA — is still open.

**[NEEDS OWNER DECISION.]** This requirement cannot be satisfied as written in Phase 2 without inventing a host surface, which I am not going to do. **Recommendation, and what the tickets assume:** the fingerprint API returns `sampleSize` and `sourceAnalysisIds` from day one so the data is ready, and the indicator renders when its host surface is built in Phase 4/5. That is a deferral of the *rendering*, not of the *capability*, and it costs nothing later. If the owner wants something visible in Phase 2, the only honest option is a small read-only panel in the existing analyses view, which needs a design pass from Jessica and is not currently ticketed.

---

## 7. Carousels — N media parts

### 7.1 `MediaPart`

```ts
export interface MediaPart {
  index: number;                 // slide order, 0-based
  kind: "video" | "image";
  url: string;
  durationSec: number | null;    // videos only
  width: number | null;
  height: number | null;
}
```

`MediaMetadata` gains `mediaParts: MediaPart[]`. `videoUrl` is **retained** — it backs the existing `analyses.video_url` column and the "URL expired, re-run" error hint in `pipeline/index.ts` — and is defined as the first video part's URL, or `null`. Non-carousel posts produce a single-element `mediaParts` (or an empty array for an image post), so **the reel path and the carousel path stop being different code**. That convergence is the point of the refactor; two paths is how `resolveVideoChild()` came to silently drop slides 2..N.

### 7.2 `resolveMediaParts()` replaces `resolveVideoChild()`

In `lib/server/analysis/media/`, consuming the ScrapeCreators payload. Every `edge_sidecar_to_children` node becomes a part, in document order: `video_url` present or `__typename === "XDTGraphVideo"` or `is_video === true` → `video`; else `display_url`/`thumbnail_src` → `image`.

`adapter.ts` keeps `resolveAudio()` sourcing from the **first** video child (unchanged behaviour, still correct — the audio track is a property of the post, and there is one `audioTitle` column). `durationSec` becomes the **sum across video parts** [plan §4.1: the current per-slide guard is bypassable via carousels].

**[VERIFY]** The carousel **video**-child shape is still unconfirmed — `lib/server/scrapecreators/types.ts:67` records that the only captured sample is all-image, and `adapter.ts` already logs loudly when a video child lacks the expected fields. `resolveMediaParts()` must not assume the video-child shape without a real payload. This is a direct dependency on §9's fixture work, and it is why the fixtures ticket is sequenced first.

### 7.3 `prepareParts()` — getting N parts to Gemini

**[TL] Videos go through the File API; images go inline as `inlineData` base64.** Images in a carousel are small (a few hundred KB), and the File API costs a download + upload + `pollUntilReady` poll loop per file — on a 10-slide carousel that is 10 sequential poll loops for content that fits in the request. Inlining removes that entirely. Videos have no such option and keep the existing upload/poll path.

Consequences to build:

- `downloader/` gains `downloadMedia(url, { maxBytes })` alongside `downloadVideo`. It is the same SSRF-guarded `requestWithSsrfGuard` path — **images must not bypass the SSRF guard**, they are attacker-influenceable URLs from a third-party payload exactly like video URLs are.
- `gemini/upload.ts` `getMimeType()` gains `jpg/jpeg/png/webp` (currently returns `application/octet-stream` for anything non-video, which Gemini will reject).
- `gemini/generate.ts` signature changes from `(fileUri: string | null, prompt)` to `(parts: GeminiMediaPart[], prompt)`.
- Cleanup: `pipeline`'s `finally` currently deletes one `videoPath`. It must delete **all** temp files, including on the partial-failure path where slide 3 of 7 fails.
- Ordering: media parts precede the text prompt and are emitted in slide order, so the slide manifest in §7.5 lines up with what Gemini sees.

### 7.4 Third `analysis_mode` — migration 008

Today: `CHECK(analysis_mode IN ('full_video','metadata_only'))`. Once an all-image carousel has its images sent to Gemini, it is **neither** — it is a real visual analysis with no video, and recording it as `metadata_only` would repeat the exact defect the plan §4.1 names ("a caption-only guess renders identically to a real video analysis").

Migration 008 relaxes the CHECK to `('full_video','images_only','metadata_only')`. Assignment: any video part → `full_video`; no video but ≥1 image part → `images_only`; no media at all → `metadata_only`. **[TL]** This pairs with `CAROUSEL_STATIC` [PRD §4.3.6], which exists precisely because an all-image carousel must still receive a valid archetype. Note SQLite cannot `ALTER` a CHECK constraint in place — migration 008 is a table rebuild in the style of migration 005, and must reproduce **all** of migration 006's columns and the four indexes from 005 plus `idx_analyses_profile_id`. Getting this wrong silently drops columns; the ticket calls it out and the verification step diffs the schema.

### 7.5 Prompt changes for carousels

`prompts/user.ts` gains a slide manifest so Gemini can address slides by number:

```
## Slides (7 total, in order)
1. image
2. video (12s)
...
```

and the system instruction states that a carousel receives **one holistic verdict over all slides**, not a per-slide verdict [PRD §7]. `formatMediaType()` already renders `carousel (7 slides)` and stays.

### 7.6 Cost cap — needs a decision

**[NEEDS OWNER DECISION.]** Both PRD §7 and plan §4.1 flag that cost scales with slide count and that a cap is needed; neither sets one. Instagram permits up to 20 slides. A 20-slide carousel with several video slides is a materially more expensive Gemini call than a 30-second reel, and there is currently **no spend visibility at all** (plan §4.4 / audit Q2.4 — `credits_remaining` is returned by ScrapeCreators and discarded).

**Recommendation, and what the ticket implements as a named constant:** `MAX_MEDIA_PARTS = 10`, with parts beyond the cap **dropped in document order** and the drop **recorded in the slide manifest** so Gemini is told it is seeing a truncated post rather than being allowed to assume it saw everything. Plus `MAX_TOTAL_MEDIA_BYTES` as a hard aggregate ceiling on top of the existing per-file `MAX_VIDEO_BYTES`. Both constants, both trivially tunable. **The owner should confirm 10 or name a different number.** Silent truncation without telling the model would be its own fabrication bug, which is why the manifest note is not optional.

---

## 8. Frontend

### 8.1 The non-negotiable sequencing constraint

**The frontend work ships in the same batch as the backend schema change** [PRD §4.6, §13]. Not as a follow-up PR, not in the next sprint. On a 1–5 scale the existing thresholds (`>=7` green, `>=5` yellow) render **every score red or yellow**, the radial gauge divides by 10 so a perfect 5 draws as a half-empty ring labelled "5 / 10", and `AnalysisDataTable` renders four columns of `—` for dimensions that no longer exist. Any window in which backend has merged and frontend has not is a visibly broken app.

Mechanically, in the tickets: the backend contract ticket and the frontend rendering ticket **both merge before anything is deployed**, and the QA pass covers them together.

### 8.2 Changes

**`lib/api/analyses/types.ts`** — mirror the new `ContentAnalysis`; re-export taxonomy types from `lib/analysis/taxonomy`; delete `Patterns`.

**`app/api/analyses/route.ts`** — delete the inline dimension-list cast (lines 25–36), import `ContentAnalysis`. Also surface `schemaVersion` on the list item so the UI can degrade gracefully on a version it doesn't know.

**`AnalysisScorecardSection.tsx`** — four separate fixes, all mandatory:
1. `DIMENSIONS` → the new 7 with Indonesian-aware labels.
2. `getScoreColor` → `>= 4` green, `>= 3` yellow, else red. **[TL]** On a 5-band anchored rubric, 4–5 is "good", 3 is "adequate", 1–2 is "poor" — that is what the bands say, so the ramp should say it too.
3. `(overallScore / 10) * 327` → `/ MAX_SCORE`, and `(score / 10) * 163` likewise, with `MAX_SCORE = 5` imported from a constant. **Do not hardcode 5 in a template literal** — that is how the 10 got scattered across four call sites.
4. The literal `/ 10` label → `/ {MAX_SCORE}`.

**`AnalysisDataTable.tsx`** — it has its **own** `getScoreColor`/`getScoreBg` with the same thresholds. **[TL]** Both components' threshold logic moves to a single shared helper; two copies of a rule that just broke is how it breaks again. Replace the seven `DimensionScoreCell`s with the new dimensions, rename the headers ("A/V", "Trend", "Brand" are gone), and fix `colSpan={12}` if the column count changes.

**`AnalysisPatternsSection.tsx`** — `viralFormulas` and `audiencePsychology` no longer exist. The component reduces to `redFlags` and is **relabelled "Red Flags"** — not "Recurring Red Flags" [PRD §2, plan §4.3: the output is neither recurring nor comparative]. **[TL]** Rename the module to `AnalysisRedFlagsSection` to match; leaving a component called `Patterns` rendering one array of red flags is exactly the naming drift that produced the original mislabel. Update `sections/types.ts` accordingly.

**New: `AnalysisStyleSection`** — renders Tier 1. This is the *primary* payload of the redesign and it needs somewhere to go in `AnalysisDetailModal`. Enum values render through `lib/analysis/taxonomy/labels.ts` (Indonesian labels, English identifiers underneath) [PRD §4.2]. Follows the module convention: `sections/AnalysisStyleSection/{index.tsx,AnalysisStyleSection.tsx,types.ts,constants.ts,helpers.ts}`.

**[NEEDS OWNER/DESIGN INPUT — does not block the backend.]** There is no approved design for the Tier 1 style section. The PRD specifies the *fields*, not their presentation, and Jessica has not designed this surface. The ticket specifies a straightforward labelled attribute list plus a beat-map timeline so the data is visible and the release is not broken — but if the owner wants a considered layout for what is now the headline output of the product, that is a design pass, and it should happen rather than being retrofitted after the fact. Placement of the style section relative to the scorecard in the modal is likewise a design call, not mine.

---

## 9. Tests — sequenced first, and why

**Current state: zero test files, no test runner, no CI, `.claude/context/verified-facts.md` does not exist** — while `AGENTS.md` mandates that all external-API work read it and halt if it is absent, which technically blocks several tickets in this plan and in Phase 1.

**My call: the harness lands FIRST, as ticket 1, not alongside and not after.** The standing recommendation in plan §2.2 was "alongside"; I am tightening it to "first", and the justification is specific to this phase rather than general:

1. This phase changes the **prompt and the parser simultaneously**. When output goes wrong — and on a taxonomy this size it will — there is no signal distinguishing a prompt regression from an extraction bug. That is the argument plan §2.2 already makes, and it is correct.
2. It is stronger here than stated there, because §4.5 makes validation **throw**. Fabricated-`5` failures that were previously invisible become loud — and the first few weeks of that are indistinguishable from a broken validator unless golden-file tests pin the validator's behaviour independently.
3. §7.2 has a **hard dependency** on it: the carousel video-child shape is unconfirmed, and `AGENTS.md` forbids guessing at external response shapes. The fixture capture *is* the verification.
4. It is one ticket. `vitest` + a fixtures directory + three golden files. Front-loading it costs a day and it pays for itself inside this phase.

Scope of ticket 1: add `vitest`, `npm run test`; create `.claude/context/verified-facts.md`; capture real ScrapeCreators payloads as fixtures (Instagram reel, all-image carousel, **video-bearing carousel** — the missing one); golden-file tests for `adapter.ts`. Parser/validation golden files land with the parser rewrite, because the contract they pin does not exist yet.

This **supersedes issue #36**, which asks for exactly the adapter validation harness. #36 should be closed as superseded, referencing the new ticket, rather than left open to be done twice.

---

## 10. Migrations

| # | Purpose | Notes |
|---|---|---|
| 007 | `ALTER TABLE analyses ADD COLUMN schema_version INTEGER;` + index | Additive. Existing 2 rows stay NULL = "pre-redesign", no backfill [PRD §9] |
| 008 | Rebuild `analyses` to relax the `analysis_mode` CHECK to include `images_only` | **Table rebuild** — SQLite cannot alter a CHECK. Must reproduce every column from 004/006/007 and every index from 005/006 |
| 009 | `CREATE TABLE profile_style_fingerprints` | Additive |

**No data migration.** 2 rows in `analyses`, 1 in `profiles` [PRD §9]. The two existing analyses carry the old contract; they will fail the new validator if re-read as v2, which is why `schema_version` exists and why the UI branches on it. **[TL]** Recommend simply deleting the 2 rows once 007 lands — they are worth nothing and keeping them means carrying a v1 rendering path forever. That is the owner's call, but it is a 30-second call.

**Operational instruction, carried from [PRD §9] into every ticket:** do not run analyses under the old contract while this is being built. Anything produced now must be re-run anyway.

---

## 11. Collisions with in-flight work

| In flight | Touches | Collision |
|---|---|---|
| **PR #52** (auth hardening, rate limit, `existingId`) | `proxy.ts`, `app/api/auth/*`, `app/api/analyze/route.ts` | **None.** Disjoint from everything here |
| **PR #63 / issue #53** (SC YouTube client) | `lib/server/scrapecreators/` | **Low.** Additive new endpoint files. Ticket 1's fixtures directory is shared — coordinate on `.claude/context/verified-facts.md`, which **both** need to create. Whoever lands first creates it; the other appends |
| **#54** (YouTube fetcher metadata path) | `fetcher/youtube.ts`, `fetcher/adapter.ts`, `fetcher/router.ts` | **REAL — `adapter.ts`.** §7.2 restructures the same file. Sequence: **#54 merges before the carousel ticket starts**, or the carousel ticket rebases onto it. Do not run them concurrently |
| **#57** (YouTube profile resolution) | `pipeline/index.ts` (removes the `if (platform === "instagram")` guard), `lib/server/profiles/` | **REAL — `pipeline/index.ts`.** The pipeline-wiring ticket rewires the same function. Sequence #57 first — it is a small, well-defined edit, and rebasing it onto a rewired pipeline is harder than the reverse. `profiles/` itself is **not** a collision: the fingerprint deliberately lives in its own table and module |

Net: the YouTube chain (#53 → #54 → #57) is strictly serial and already blocked on a ScrapeCreators credit top-up. **The taxonomy, schema, prompt, parser and test tickets have zero overlap with it and can start immediately.** Only the pipeline-wiring and carousel tickets need the YouTube chain to land first.

---

## 12. What is settled vs. what needs verification

**Settled — build to it, do not relitigate:** all four taxonomies and their exact value lists; `ctaTiming` and the biconditional `NONE` rule; `hasAudienceCallout` as a separate boolean; primary + optional secondary hook; the 7 scorecard dimensions and what was removed and why; the 1–5 scale; temperature 0; structured output; anchored 5-band rubrics; loud failure; `schemaVersion`; fingerprint derived from ≥5 analyzed videos, versioned, separate table, human-editable, equal video weighting, includes caption style, `brandConsistency` relocated as descriptive; carousels as one analysis over all slides; no creator/competitor distinction; schema replacement rather than migration.

**[VERIFY] during implementation — do not assume:**
1. `responseSchema` support and expressiveness on `@google/generative-ai@0.24.1`, including nullable numerics and enum arrays (§4.2). Escalate rather than fall back to prose parsing.
2. Real `maxOutputTokens` headroom for the full contract on a long carousel, with thinking tokens counted (§4.2).
3. The ScrapeCreators carousel **video**-child payload shape — still uncaptured, `AGENTS.md` forbids guessing (§7.2).
4. Whether `OTHER` rates land under the 10% target once the localised few-shots are in. This is the instrument that tells us if the taxonomy is missing something Indonesian-specific (§4.6).

**[NEEDS OWNER DECISION] before or during Phase 2:**
1. **`MAX_MEDIA_PARTS` cap** (§7.6). Recommended 10. Needed before the carousel ticket merges. PRD flags the need and sets no number.
2. **Confidence indicator host surface** (§6.5). PRD puts it in scope for this phase but both named surfaces are out of scope. Recommended: expose in the API now, render when the profile page exists.
3. **Tier 1 style section design** (§8.2). No design exists for what is now the product's headline output. Recommended: ship a functional attribute list, book a design pass.
4. **Delete the 2 legacy analyses rows?** (§10). Recommended yes.
5. **Equal weighting of the four dimensions inside `consistencyIndex`** (§6.4). Recommended yes; low urgency.

None of 1–5 blocks the first four tickets.
