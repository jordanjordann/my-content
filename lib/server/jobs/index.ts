// Barrel — re-exports only, no implementation. Ticket #352 (3A-M1b).

export {
  ANALYSIS_MAX_ATTEMPTS,
  HEARTBEAT_INTERVAL_MS,
  POLL_INTERVAL_MS,
  STALE_JOB_MULTIPLIER,
  STALE_JOB_THRESHOLD_MS,
} from "./constants";
export { buildDedupeKey, hashPrompt } from "./dedupe";
export { claim, enqueue, getJobs, heartbeat, markFailed, markSucceeded } from "./repository";
export type { EnqueueInput, HeartbeatInput } from "./repository";
export type {
  AnalysisJobPayload,
  ClaimResult,
  EnqueueResult,
  JobKind,
  JobRow,
  JobStatus,
} from "./types";
