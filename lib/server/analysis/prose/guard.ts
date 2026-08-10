import { BASELINE_MIN_SAMPLE } from "@/lib/server/analysis/performance/constants";
import { PROFILE_TTL_DAYS } from "@/lib/server/profiles/constants";
import { DENOMINATOR_KEYWORDS_ID, DENOMINATOR_WINDOW_CHARS } from "./constants";
import type { ComputedPerformanceBlock } from "./types";

/**
 * TDD §8.2/§8.3 (Half B — the deterministic post-generation prose guard).
 * Gemini's Indonesian prose is not deterministic, so a fixture-based unit
 * test cannot guard tomorrow's generation — these functions run in the
 * parser stage, on every real completion, before persistence.
 *
 * `ProseQualifierError` — thrown by `assertQualifiedPercentages` when a
 * bare, unqualified percentage escapes into `verdict`/`drivers[]`.
 */
export class ProseQualifierError extends Error {
  readonly violatingSubstring: string;

  constructor(violatingSubstring: string, context: string) {
    super(`Unqualified percentage "${violatingSubstring}" in: ${context}`);
    this.name = "ProseQualifierError";
    this.violatingSubstring = violatingSubstring;
  }
}

/** Thrown by `assertNumeralsAreReal` when a numeral in the prose was never handed to the model (S2/AC-7). */
export class NumeralFabricationError extends Error {
  readonly violatingSubstring: string;

  constructor(violatingSubstring: string, context: string) {
    super(`Fabricated numeral "${violatingSubstring}" (not in the computed block) in: ${context}`);
    this.name = "NumeralFabricationError";
    this.violatingSubstring = violatingSubstring;
  }
}

/**
 * Percentage token matcher (TDD §8.2). **Both** decimal separators —
 * Indonesian prose is supposed to use `,` (`4,1%`) but a drifted generation
 * could emit the dot convention (`4.1%`) instead, and both must be caught.
 */
const PERCENT_TOKEN_RE = /\d{1,3}(?:[.,]\d+)?\s*%/g;

/**
 * R-12.5.1/R-12.5.2/R-12.5.4/AC-22: every percentage in `verdict`/
 * `drivers[]` must carry its denominator in words, within
 * `DENOMINATOR_WINDOW_CHARS` characters. **No stripping, no rewriting** —
 * a violation throws (PRD §5.4: no invented values on parse failure, and
 * quietly deleting a percentage from client-facing prose is fabrication by
 * omission).
 */
export function assertQualifiedPercentages(text: string): void {
  for (const match of text.matchAll(PERCENT_TOKEN_RE)) {
    const index = match.index ?? 0;
    const windowStart = Math.max(0, index - DENOMINATOR_WINDOW_CHARS);
    const windowEnd = Math.min(text.length, index + match[0].length + DENOMINATOR_WINDOW_CHARS);
    const window = text.slice(windowStart, windowEnd).toLowerCase();

    const isQualified = DENOMINATOR_KEYWORDS_ID.some((keyword) => window.includes(keyword.toLowerCase()));
    if (!isQualified) {
      console.error("[PROSE GUARD] unqualified percentage:", match[0], "in:", text);
      throw new ProseQualifierError(match[0], text);
    }
  }
}

/** Any run of digits with optional `.`/`,` grouping — a superset that also matches every percentage token (minus the `%`). */
const NUMERAL_TOKEN_RE = /\d[\d.,]*\d|\d/g;

/**
 * Decodes a numeral token using BOTH Indonesian conventions (TDD §3.1): `,`
 * as the decimal separator with `.` as the thousands separator (the
 * intended convention — `"482.100,5"` -> `482100.5`), and a bare dot-decimal
 * fallback for a drifted generation (`"4.1"` -> `4.1`, not `41` or `4100`).
 * Returns `null` if the token cannot be parsed as a finite number.
 */
function parseIndonesianNumeral(raw: string): number | null {
  const trimmed = raw.trim().replace(/[.,]+$/, "");
  if (trimmed === "") {
    return null;
  }

  if (trimmed.includes(",")) {
    const parts = trimmed.split(",");
    if (parts.length !== 2) {
      return null;
    }
    const intPart = parts[0]!.replace(/\./g, "");
    const value = Number(`${intPart}.${parts[1]}`);
    return Number.isFinite(value) ? value : null;
  }

  if (trimmed.includes(".")) {
    const segments = trimmed.split(".");
    const last = segments[segments.length - 1]!;
    const looksLikeThousands =
      last.length === 3 && segments.slice(0, -1).every((seg, i) => (i === 0 ? seg.length >= 1 && seg.length <= 3 : seg.length === 3));

    if (looksLikeThousands) {
      const value = Number(segments.join(""));
      return Number.isFinite(value) ? value : null;
    }

    const value = Number(trimmed);
    return Number.isFinite(value) ? value : null;
  }

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** 1 decimal place for non-integers (multipliers/percentages), exact for integer counts (TDD §3.1's stated rounding tolerance). */
function numeralsMatch(extracted: number, allowed: number): boolean {
  if (Number.isInteger(extracted) && Number.isInteger(allowed)) {
    return extracted === allowed;
  }
  return Math.abs(extracted - allowed) < 0.05;
}

/**
 * OR-10 / R-13.3.4 / AC-27: `BASELINE_MIN_SAMPLE` (the `5` in "3 of 5") and
 * the profile cache TTL (the `week`/`7` in the staleness copy) are
 * exempt — they are configuration constants, not computed per-row figures,
 * and are not stored in the computed block.
 */
function allowListedNumerals(): number[] {
  return [BASELINE_MIN_SAMPLE, PROFILE_TTL_DAYS];
}

/**
 * Extracts every real numeral from `text` (skipping unparseable tokens) —
 * exported so `prompts/user.ts` can derive a prompt-supplied figure's
 * `ComputedPerformanceBlock.realNumerals` from the SAME extraction logic
 * `assertNumeralsAreReal` checks against, rather than a second hand-written
 * arithmetic path that could drift from what the prompt actually renders.
 */
export function extractNumerals(text: string): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(NUMERAL_TOKEN_RE)) {
    const parsed = parseIndonesianNumeral(match[0]);
    if (parsed !== null) {
      values.push(parsed);
    }
  }
  return values;
}

/**
 * S2/AC-7: every numeral in `text` must be one the model was actually
 * given (`block.realNumerals`, within `numeralsMatch()`'s tolerance) or on
 * the OR-10 allow-list. Anything else is a fabricated number and throws —
 * no stripping, no rewriting, no automatic repair retry (TDD §8.2: a
 * violation here means the prompt has drifted, which is information wanted,
 * not noise to paper over).
 */
export function assertNumeralsAreReal(text: string, block: ComputedPerformanceBlock): void {
  const allowed = [...block.realNumerals, ...allowListedNumerals()];

  for (const match of text.matchAll(NUMERAL_TOKEN_RE)) {
    const parsed = parseIndonesianNumeral(match[0]);
    if (parsed === null) {
      continue;
    }
    const isReal = allowed.some((value) => numeralsMatch(parsed, value));
    if (!isReal) {
      console.error("[PROSE GUARD] fabricated numeral:", match[0], "in:", text);
      throw new NumeralFabricationError(match[0], text);
    }
  }
}

/**
 * Runs both guards over `verdict` and every `drivers[]` entry — the entry
 * point the parser calls (TDD §8.2: "run in the parser stage before
 * persistence").
 */
export function assertPerformanceProseIsSafe(
  performance: { verdict: string; drivers: string[] },
  block: ComputedPerformanceBlock,
): void {
  const texts = [performance.verdict, ...performance.drivers];
  for (const text of texts) {
    assertQualifiedPercentages(text);
    assertNumeralsAreReal(text, block);
  }
}
