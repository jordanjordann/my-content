import type { StyleAttributes } from "@/lib/server/analysis/types";

/**
 * One source row `aggregate.ts` consumes. Deliberately narrower than the
 * full `analyses` row / `ContentAnalysis` — the aggregator only ever needs
 * the style payload, the post date (for `dateRange`), and the id (for
 * provenance); it has no business seeing scorecard/overallScore fields
 * (Step 4: all videos weighted equally, no score-based weighting is even
 * representable if the input never carries a score).
 */
export interface FingerprintSourceAnalysis {
  id: string;
  postDate: string | null;
  style: StyleAttributes;
}

/**
 * A `{value, count, share}` bucket. `share` is `count / totalOccurrences`,
 * where `totalOccurrences` is the number of value-instances that went into
 * the distribution — for a single-valued field (e.g. `topicNiche`) that's
 * `sampleSize`; for a field that can contribute more than one instance per
 * video (e.g. `hookType`, which counts primary + secondary; `ctaType`,
 * which is a flattened multiset), it's the flattened total. Shares within
 * one distribution therefore always sum to 1.
 */
export interface FrequencyDistributionEntry {
  value: string;
  count: number;
  share: number;
}

/** Pure aggregation output (Step 4). No LLM call, no I/O, deterministic. */
export interface ComputedFingerprint {
  topicNicheDistribution: FrequencyDistributionEntry[];
  formatArchetypeDistribution: FrequencyDistributionEntry[];
  /** Counts `hookType` primary AND `hookTypeSecondary` at equal weight. */
  hookTypeDistribution: FrequencyDistributionEntry[];
  /** Flattened multiset over each video's `ctaType` array. */
  ctaTypeDistribution: FrequencyDistributionEntry[];
  ctaTimingDistribution: FrequencyDistributionEntry[];
  pacingDistribution: FrequencyDistributionEntry[];

  /** Share of videos with `hasAudienceCallout === true`. */
  audienceCalloutRate: number;
  /** Median (not mean) of `estimatedCutsPerMinute` across videos that have a non-null value. Null if every video has a null value. */
  medianCutsPerMinute: number | null;
  /** The single most common ordered beat-type sequence across videos (ties broken by first-encountered-in-input). Empty array if no video has any beats. */
  typicalBeatSequence: string[];
  /** Median beat count per video. Null if every video has zero beats and there is nothing to take a median of. */
  medianBeatCount: number | null;
  /** Ranked frequency distribution of trim+lowercase-normalised tone tags. */
  verbalTonePatterns: FrequencyDistributionEntry[];

  /** Verbatim `captionStyleNotes`, one per source video that has one — never synthesised/summarised. */
  captionStyleExemplars: string[];
  /** Verbatim `hookText`, one per source video that has one. */
  hookTextExemplars: string[];
  /** Verbatim `onScreenText` entries, flattened across every source video. */
  onScreenTextExemplars: string[];

  sampleSize: number;
  sourceAnalysisIds: string[];
  dateRange: { earliest: string | null; latest: string | null };
}

/** `aggregate.ts`'s full return value. */
export interface AggregationResult {
  computed: ComputedFingerprint;
  /** Step 5: Simpson concentration, equal-weight mean over 4 dimensions. Descriptive only — never consumed as a re-ranking weight anywhere in this module. */
  consistencyIndex: number;
}

/** A `profile_style_fingerprints` row, as persisted. */
export interface StyleFingerprint {
  id: string;
  profileId: string;
  fingerprintVersion: number;
  schemaVersion: number;
  sampleSize: number;
  sourceAnalysisIds: string[];
  computed: ComputedFingerprint;
  /** Human corrections. Null until an operator writes one. Never touched by a recompute. */
  overrides: Record<string, unknown> | null;
  consistencyIndex: number;
  /**
   * When `computed`/`consistencyIndex` were last (re)computed by
   * `upsertFingerprint` — distinct from `updatedAt`, which also moves on a
   * human-only `PATCH` (migration 011, TDD §3 D2). `mapRow` guarantees this
   * is never `null` even for a pre-migration row (falls back to `updatedAt`
   * at read time), so the type stays non-nullable here.
   */
  computedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * `getFingerprint()`'s read-time merge (Step 2): `{...computed,
 * ...overrides}` per top-level key, plus row-level provenance and
 * `overriddenKeys` so a UI can mark which fields are human-set.
 */
export type FingerprintView = ComputedFingerprint & {
  profileId: string;
  fingerprintVersion: number;
  schemaVersion: number;
  consistencyIndex: number;
  computedAt: string;
  createdAt: string;
  updatedAt: string;
  overriddenKeys: string[];
};

/**
 * A `PATCH` request body against `overrides` (TDD §3 D3). Shallow,
 * top-level-only: each key either sets that key's override or, if the value
 * is `null`, deletes it (reverting that key to `computed`). Never nested —
 * `dateRange`'s override, if present, always replaces the whole
 * `{earliest, latest}` object, never merges into it.
 */
export type FingerprintPatch = Record<string, unknown>;

/**
 * `validateOverridePatch`'s result (TDD §3 D4/D5). Never throws; `invalidKeys`
 * names every offending top-level key so a `400` caller can report all of
 * them at once rather than one-at-a-time trial and error.
 */
export type FingerprintValidationResult = { ok: true } | { ok: false; invalidKeys: string[] };

/**
 * `patchFingerprintOverrides`'s (repository-level) result. `reason:
 * "NOT_FOUND"` is the honest not-found (TDD §3 D6) for a `PATCH` against a
 * profile with no fingerprint row — today's bare UPDATE affects 0 rows and
 * resolves successfully, which is the bug this type exists to make
 * impossible to reproduce.
 */
export type PatchOverridesResult = { ok: true; row: StyleFingerprint } | { ok: false; reason: "NOT_FOUND" };

/**
 * `applyFingerprintOverridePatch`'s (service-level orchestration) result —
 * validates against `computed` first (nothing is written on `INVALID`, TDD
 * §4), then delegates to `patchFingerprintOverrides`, then re-reads the
 * merged view so a caller (the future route ticket) needs no second
 * round-trip.
 */
export type ApplyOverridePatchResult =
  | { ok: true; view: FingerprintView }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "INVALID"; invalidKeys: string[] };
