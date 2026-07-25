import type { AggregationResult, ComputedFingerprint, FingerprintSourceAnalysis, FrequencyDistributionEntry } from "./types";

/**
 * PURE TypeScript. No I/O, no LLM call (ticket #72, Step 4). Deterministic
 * and instantly re-runnable — an LLM-summarised fingerprint would be
 * non-reproducible, undoing the reproducibility effort the rest of the
 * analysis pipeline already bought (schema versioning, structured output).
 */

/** `{value, count, share}[]`, sorted by count desc then value asc for determinism. `share` is `count / values.length` (see FrequencyDistributionEntry doc). */
function buildDistribution(values: string[]): FrequencyDistributionEntry[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const total = values.length;

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count, share: total === 0 ? 0 : count / total }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Standard median: average of the two middle values on an even-length input. Null on an empty input. */
function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Step 5: normalised Simpson concentration.
 * `C_d = (Σp_i² − 1/k) / (1 − 1/k)`, where `k` is the number of distinct
 * values observed and `p_i` is each value's share. `C_d = 1` when only one
 * distinct value is observed (k <= 1) — the `1/k` normalisation denominator
 * would otherwise divide by zero.
 */
function simpsonConcentration(values: string[]): number {
  const total = values.length;
  if (total === 0) {
    return 0;
  }

  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const k = counts.size;
  if (k <= 1) {
    return 1;
  }

  const sumSquaredShares = Array.from(counts.values()).reduce((acc, count) => acc + (count / total) ** 2, 0);
  return (sumSquaredShares - 1 / k) / (1 - 1 / k);
}

/** Ordered beat-type sequence for one video, sorted by `timestampSec`. */
function beatSequence(source: FingerprintSourceAnalysis): string[] {
  return [...source.style.structureBeatMap]
    .sort((a, b) => a.timestampSec - b.timestampSec)
    .map((beat) => beat.beatType);
}

/**
 * Most common ordered beat sequence across videos. Ties are broken by
 * first-encountered-in-input order (stable, deterministic — never a
 * function of anything but input order).
 */
function typicalBeatSequence(sources: FingerprintSourceAnalysis[]): string[] {
  const sequences = sources.map(beatSequence);
  const counts = new Map<string, { sequence: string[]; count: number }>();

  for (const sequence of sequences) {
    const key = JSON.stringify(sequence);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { sequence, count: 1 });
    }
  }

  let best: { sequence: string[]; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) {
      best = entry;
    }
  }

  return best?.sequence ?? [];
}

function dateRange(sources: FingerprintSourceAnalysis[]): { earliest: string | null; latest: string | null } {
  const dates = sources.map((source) => source.postDate).filter((date): date is string => date != null);

  if (dates.length === 0) {
    return { earliest: null, latest: null };
  }

  const sorted = [...dates].sort();
  return { earliest: sorted[0], latest: sorted[sorted.length - 1] };
}

/**
 * Aggregates a creator's `StyleAttributes` corpus into a `ComputedFingerprint`
 * plus its `consistencyIndex`. All videos weighted equally throughout — no
 * `overallScore` weighting, no scorecard weighting (Step 4, PRD §6.1
 * explicit and confirmed).
 *
 * Caller (service.ts) is responsible for the `MIN_ANALYSES_FOR_FINGERPRINT`
 * cold-start gate — this function itself makes no assumption about a
 * minimum corpus size and will happily aggregate over any non-negative
 * number of sources (empty input yields well-defined, if degenerate,
 * zero/null/empty output).
 */
export function aggregateStyleFingerprint(sources: FingerprintSourceAnalysis[]): AggregationResult {
  const sampleSize = sources.length;

  const topicNicheDistribution = buildDistribution(sources.map((source) => source.style.topicNiche));
  const formatArchetypeDistribution = buildDistribution(sources.map((source) => source.style.formatArchetype));

  // hookType distribution counts primary and secondary at equal weight
  // (Step 4) — discarding the secondary would waste the ~13% of hooks that
  // genuinely carry two (PRD §6.1).
  const hookTypeValues = sources.flatMap((source) =>
    source.style.hookTypeSecondary ? [source.style.hookType, source.style.hookTypeSecondary] : [source.style.hookType],
  );
  const hookTypeDistribution = buildDistribution(hookTypeValues);

  // ctaType is a flattened multiset — each video's ctaType array
  // contributes one instance per element (`["NONE"]` contributes one NONE
  // instance; a two-CTA video contributes two instances).
  const ctaTypeValues = sources.flatMap((source) => source.style.ctaType);
  const ctaTypeDistribution = buildDistribution(ctaTypeValues);

  const ctaTimingDistribution = buildDistribution(sources.map((source) => source.style.ctaTiming));
  const pacingDistribution = buildDistribution(sources.map((source) => source.style.pacing));

  const audienceCalloutRate =
    sampleSize === 0 ? 0 : sources.filter((source) => source.style.hasAudienceCallout).length / sampleSize;

  const cutsPerMinuteValues = sources
    .map((source) => source.style.estimatedCutsPerMinute)
    .filter((value): value is number => value != null);
  const medianCutsPerMinute = median(cutsPerMinuteValues);

  const beatCounts = sources.map((source) => source.style.structureBeatMap.length);
  const medianBeatCount = median(beatCounts);

  const verbalToneValues = sources.flatMap((source) =>
    source.style.verbalTonePatterns.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0),
  );
  const verbalTonePatterns = buildDistribution(verbalToneValues);

  const captionStyleExemplars = sources
    .map((source) => source.style.captionStyleNotes)
    .filter((note): note is string => !!note && note.trim().length > 0);
  const hookTextExemplars = sources
    .map((source) => source.style.hookText)
    .filter((text): text is string => !!text && text.trim().length > 0);
  const onScreenTextExemplars = sources
    .flatMap((source) => source.style.onScreenText)
    .filter((text): text is string => !!text && text.trim().length > 0);

  const computed: ComputedFingerprint = {
    topicNicheDistribution,
    formatArchetypeDistribution,
    hookTypeDistribution,
    ctaTypeDistribution,
    ctaTimingDistribution,
    pacingDistribution,
    audienceCalloutRate,
    medianCutsPerMinute,
    typicalBeatSequence: typicalBeatSequence(sources),
    medianBeatCount,
    verbalTonePatterns,
    captionStyleExemplars,
    hookTextExemplars,
    onScreenTextExemplars,
    sampleSize,
    sourceAnalysisIds: sources.map((source) => source.id),
    dateRange: dateRange(sources),
  };

  // Step 5: equal-weight mean over 4 dimensions. hookType uses PRIMARY
  // only here (unlike the distribution above, which counts primary +
  // secondary) — the ticket names "hookType (primary)" explicitly for
  // consistencyIndex. ctaType is the same flattened multiset as its
  // distribution above.
  const consistencyIndex =
    (simpsonConcentration(sources.map((s) => s.style.formatArchetype)) +
      simpsonConcentration(sources.map((s) => s.style.hookType)) +
      simpsonConcentration(ctaTypeValues) +
      simpsonConcentration(sources.map((s) => s.style.pacing))) /
    4;

  return { computed, consistencyIndex };
}
