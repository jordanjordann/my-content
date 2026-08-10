// Barrel — only re-exports, no implementation (AGENTS.md module conventions).
export {
  assertNumeralsAreReal,
  assertPerformanceProseIsSafe,
  assertQualifiedPercentages,
  extractNumerals,
  NumeralFabricationError,
  ProseQualifierError,
} from "./guard";
export { DENOMINATOR_KEYWORDS_ID, DENOMINATOR_PHRASES_ID, DENOMINATOR_WINDOW_CHARS } from "./constants";
export type { ComputedPerformanceBlock } from "./types";
