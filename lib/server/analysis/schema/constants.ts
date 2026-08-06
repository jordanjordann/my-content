/**
 * Analysis result contract version (PRD §4.4, TDD §3.3).
 *
 * An integer, not semver: the PRD permits either and nothing branches on a
 * minor/patch distinction. Version 1 is retroactively the pre-redesign
 * contract — those rows carry no `schemaVersion` key at all, so
 * `schemaVersion === undefined` reads as version 1 without a backfill.
 *
 * Increment on every future change to the analysis result shape.
 *
 * Bumped 2 -> 3 by ticket #139 (TDD §1.2, §5): migration 012 drops
 * `engagement_rate` and adds the performance-block columns. This
 * deliberately cold-starts every profile's style fingerprint (the
 * fingerprint engine filters on `schema_version = ANALYSIS_SCHEMA_VERSION`
 * completed rows) until 5 new schema-3 analyses exist per profile — an
 * accepted consequence, not a bug (TDD §1.2 / E4).
 */
export const ANALYSIS_SCHEMA_VERSION = 3;
