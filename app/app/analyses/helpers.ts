import type { ReadonlyURLSearchParams } from "next/navigation";

import type {
  AnalysisListItemIndexed,
  AnalysisPlatform,
  AnalysisStatus,
} from "@/lib/api/analyses/types";
import { normalize } from "@/lib/api/analyses/helpers";
import {
  FILTER_PARAM_KEYS,
  MAX_SCORE,
  PLATFORM_OPTIONS,
  SCORE_BAND_WORDS,
  STATUS_OPTIONS,
} from "@/app/app/analyses/constants";
import type { AnalysisFilters, FilterDimension, ScoreBand } from "@/app/app/analyses/types";

const PLATFORM_VALUES = new Set<string>(PLATFORM_OPTIONS.map((option) => option.value));
const STATUS_VALUES = new Set<string>(STATUS_OPTIONS.map((option) => option.value));

export { normalize };

/**
 * Parses a comma-separated URL param into a trimmed, de-duped list.
 * `null`/`""` -> `[]`. Preserves first-seen order.
 */
export function parseListParam(raw: string | null): string[] {
  if (!raw) return [];

  const seen = new Set<string>();
  const values: string[] = [];

  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    values.push(trimmed);
  }

  return values;
}

/**
 * Parses filter state from URL search params. Unknown `platform`/`status` values (e.g. from a
 * hand-edited URL) are silently dropped. Unknown `account` values are kept — the account list
 * is dynamic, so a stale-but-valid handle should chip with a 0 count rather than vanish.
 */
export function parseFiltersFromParams(params: ReadonlyURLSearchParams): AnalysisFilters {
  const account = parseListParam(params.get(FILTER_PARAM_KEYS.account));

  const platform = parseListParam(params.get(FILTER_PARAM_KEYS.platform)).filter((value) =>
    PLATFORM_VALUES.has(value),
  ) as AnalysisPlatform[];

  const status = parseListParam(params.get(FILTER_PARAM_KEYS.status)).filter((value) =>
    STATUS_VALUES.has(value),
  ) as AnalysisStatus[];

  const q = params.get(FILTER_PARAM_KEYS.keyword) ?? "";

  return { account, platform, status, q };
}

function setOrDeleteList(params: URLSearchParams, key: string, values: string[]): void {
  if (values.length > 0) {
    params.set(key, values.join(","));
  } else {
    params.delete(key);
  }
}

/**
 * Merges the next filter state into `current`'s params. Preserves unrelated params (critically
 * `id`, which drives the detail modal) and selection order — never re-sorts. An empty
 * array/`q === ""` deletes that param entirely, rather than writing it as an empty string.
 */
export function buildFilterQueryString(current: URLSearchParams, next: AnalysisFilters): string {
  const params = new URLSearchParams(current);

  setOrDeleteList(params, FILTER_PARAM_KEYS.account, next.account);
  setOrDeleteList(params, FILTER_PARAM_KEYS.platform, next.platform);
  setOrDeleteList(params, FILTER_PARAM_KEYS.status, next.status);

  if (next.q !== "") {
    params.set(FILTER_PARAM_KEYS.keyword, next.q);
  } else {
    params.delete(FILTER_PARAM_KEYS.keyword);
  }

  return params.toString();
}

/**
 * Case-insensitive multi-token AND match over the precomputed `searchText` field. Splits the
 * normalized query on whitespace and requires every token to be present — this is what lets
 * `"viral hook"` match a title like "Hook that went viral". An empty/whitespace-only query
 * imposes no constraint (matches everything, not nothing).
 */
export function matchesKeyword(item: AnalysisListItemIndexed, q: string): boolean {
  const tokens = normalize(q).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => item.searchText.includes(token));
}

/**
 * Dimension-only match (Account/Platform/Status), OR within a dimension, AND across dimensions.
 * A dimension with zero selections imposes no constraint. `exclude` skips one dimension's own
 * selections entirely — used to compute contextual per-option counts that ignore a dimension's
 * own current selections (see `useFilteredAnalyses`).
 */
export function matchesDimensions(
  item: AnalysisListItemIndexed,
  filters: AnalysisFilters,
  exclude?: FilterDimension,
): boolean {
  const accountMatch =
    exclude === "account" ||
    filters.account.length === 0 ||
    filters.account.includes(item.username);

  const platformMatch =
    exclude === "platform" ||
    filters.platform.length === 0 ||
    filters.platform.includes(item.platform);

  const statusMatch =
    exclude === "status" || filters.status.length === 0 || filters.status.includes(item.status);

  return accountMatch && platformMatch && statusMatch;
}

/**
 * OR within a dimension, AND across dimensions. Does not apply the keyword — combine with
 * `matchesKeyword` at the call site (keyword is ANDed on top of everything else).
 */
export function matchesFilters(item: AnalysisListItemIndexed, filters: AnalysisFilters): boolean {
  return matchesDimensions(item, filters);
}

/** Whether any filter dimension has a selection, or the keyword is non-empty. */
export function anyActive(filters: AnalysisFilters): boolean {
  return (
    filters.account.length > 0 ||
    filters.platform.length > 0 ||
    filters.status.length > 0 ||
    filters.q !== ""
  );
}

/**
 * Single shared source of the 1-5 score color ramp (TDD §8.2 — was
 * independently duplicated in `AnalysisScorecardSection` and
 * `AnalysisDataTable` with pre-redesign 1-10 thresholds; both now import
 * this). On a 5-band anchored rubric, 4-5 is "good", 3 is "adequate", 1-2
 * is "poor" — the ramp says what the bands say.
 */
export function getScoreColorClass(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 4) return "text-green-600 dark:text-green-400";
  if (score >= 3) return "text-yellow-600 dark:text-yellow-400";
  return "text-destructive";
}

/** Background variant of `getScoreColorClass`, for filled badges/pills. */
export function getScoreBgClass(score: number | null): string {
  if (score == null) return "bg-muted";
  if (score >= 4) return "bg-green-500/10";
  if (score >= 3) return "bg-yellow-500/10";
  return "bg-destructive/10";
}

/** Plain-language band word for an integer 1-5 score (design doc §2.1). */
export function getScoreBandWord(score: number): ScoreBand {
  const index = Math.min(Math.max(Math.round(score), 1), MAX_SCORE);
  return SCORE_BAND_WORDS[index] as ScoreBand;
}

/** `"4/5 · Strong"` — the text equivalent that must always accompany a pip meter (a11y §4). */
export function formatScoreBandLabel(score: number): string {
  return `${score}/${MAX_SCORE} · ${getScoreBandWord(score)}`;
}
