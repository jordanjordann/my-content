/**
 * Client-side mirror of `lib/server/fingerprint/types.ts`'s `ComputedFingerprint`/
 * `FingerprintView` (TDD §4, `docs/TDD-fingerprint-read-override-api.md`), and of the
 * `404` bodies returned by `app/api/profiles/[id]/fingerprint/route.ts`. Deliberately
 * NOT imported from `lib/server/fingerprint` — the client module stays independent of
 * server-layer types (mirroring the precedent in `lib/api/analyses/types.ts`, which
 * only reuses genuinely shared taxonomy types, never server-internal ones). Field
 * names/shapes here are cross-checked against the route's actual `serializeView`
 * (a passthrough — TDD §8[B]) and its two `404` branches, not just the TDD prose.
 */

export type FrequencyDistributionEntry = {
  value: string;
  count: number;
  share: number;
};

export type FingerprintDateRange = {
  earliest: string | null;
  latest: string | null;
};

/**
 * `GET`/`PATCH` `200` body — the merged (`computed` + `overrides`) fingerprint view,
 * byte-identical between the two verbs so a `PATCH` caller needs no follow-up `GET`.
 */
export type FingerprintView = {
  topicNicheDistribution: FrequencyDistributionEntry[];
  formatArchetypeDistribution: FrequencyDistributionEntry[];
  /** Counts `hookType` primary AND `hookTypeSecondary` at equal weight. */
  hookTypeDistribution: FrequencyDistributionEntry[];
  /** Flattened multiset over each source video's `ctaType` array. */
  ctaTypeDistribution: FrequencyDistributionEntry[];
  ctaTimingDistribution: FrequencyDistributionEntry[];
  pacingDistribution: FrequencyDistributionEntry[];
  audienceCalloutRate: number;
  medianCutsPerMinute: number | null;
  typicalBeatSequence: string[];
  medianBeatCount: number | null;
  verbalTonePatterns: FrequencyDistributionEntry[];
  captionStyleExemplars: string[];
  hookTextExemplars: string[];
  onScreenTextExemplars: string[];
  /** Never overridable (TDD §3 D1) — provenance, not content. */
  sampleSize: number;
  sourceAnalysisIds: string[];
  dateRange: FingerprintDateRange;
  profileId: string;
  fingerprintVersion: number;
  schemaVersion: number;
  consistencyIndex: number;
  /** Last recompute time (TDD §3 D2) — distinct from `updatedAt`, which also moves on a human-only `PATCH`. */
  computedAt: string;
  createdAt: string;
  updatedAt: string;
  /** Top-level keys currently human-overridden (TDD §3 D7 read-time merge). */
  overriddenKeys: string[];
};

/** `404` — the profile itself doesn't exist (TDD §3 D7). */
export type FingerprintProfileNotFound = {
  error: string;
  reason: "PROFILE_NOT_FOUND";
};

/**
 * `404` — a real profile, but fewer than `required` qualifying analyses so far. This is
 * a normal, expected cold-start product state, not a failure (TDD §3 D7) — never
 * synthesize a zeroed `FingerprintView` to stand in for it.
 */
export type FingerprintNoFingerprintYet = {
  error: string;
  reason: "NO_FINGERPRINT";
  analysisCount: number;
  required: number;
};

export type FingerprintAbsence = FingerprintProfileNotFound | FingerprintNoFingerprintYet;

/**
 * `fetchFingerprint`/`patchFingerprintOverrides`'s return type. A `404` resolves here
 * as a typed member of this union (discriminated by the real `reason` field the route
 * already sends) rather than a thrown error — only `401`/`400`/`500` throw.
 */
export type FingerprintResult = FingerprintView | FingerprintAbsence;

/**
 * `PATCH` request body (TDD §3 D3). Shallow, top-level-only: a non-`null` value SETS
 * that key's override; literal `null` DELETES it, reverting to `computed`. Never
 * nested — e.g. an override on `dateRange` always replaces the whole object.
 */
export type FingerprintOverridePatch = Record<string, unknown>;

/**
 * `useFingerprint`'s `select` output (TDD §6). All derivation lives here per
 * AGENTS.md's data-transformation-layering rule — no consumer should ever branch on
 * raw `overriddenKeys`/distribution arrays directly.
 */
export type FingerprintSelection =
  | {
      status: "found";
      view: FingerprintView;
      overriddenKeys: Set<string>;
      isOverridden: (key: string) => boolean;
      topDistributionValue: (distribution: FrequencyDistributionEntry[]) => string | null;
    }
  | {
      status: "absent";
      absence: FingerprintAbsence;
    };
