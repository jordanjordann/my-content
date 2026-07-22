/**
 * Analysis result contract version (PRD §4.4, TDD §3.3).
 *
 * An integer, not semver: the PRD permits either and nothing branches on a
 * minor/patch distinction. Version 1 is retroactively the pre-redesign
 * contract — those rows carry no `schemaVersion` key at all, so
 * `schemaVersion === undefined` reads as version 1 without a backfill.
 *
 * Increment on every future change to the analysis result shape.
 */
export const ANALYSIS_SCHEMA_VERSION = 2;
