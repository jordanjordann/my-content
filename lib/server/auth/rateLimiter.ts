import {
  PIN_GLOBAL_RATE_LIMIT_LOCKOUT_MS,
  PIN_GLOBAL_RATE_LIMIT_MAX_ATTEMPTS,
  PIN_GLOBAL_RATE_LIMIT_MAX_LOCKOUT_MS,
  PIN_GLOBAL_RATE_LIMIT_WINDOW_MS,
  PIN_RATE_LIMIT_LOCKOUT_MS,
  PIN_RATE_LIMIT_MAX_ATTEMPTS,
  PIN_RATE_LIMIT_MAX_LOCKOUT_MS,
  PIN_RATE_LIMIT_MAX_TRACKED_KEYS,
  PIN_RATE_LIMIT_WINDOW_MS,
} from "./constants";

type AttemptRecord = {
  count: number;
  windowStart: number;
  lockedUntil: number;
  lockoutStrikes: number;
};

// In-memory, single-process rate limiter keyed by client identifier (IP).
// This app runs as a single `next start` Node process, single user,
// SQLite-backed — per-process memory is an acceptable store for now.
//
// Limitation: state resets on process restart and is NOT shared across
// instances. If this app is ever horizontally scaled (multiple processes /
// containers behind a load balancer), this needs to move to a shared store
// (e.g. Redis) — an in-memory Map will not enforce a global limit.
//
// Bounding: the map is capped at PIN_RATE_LIMIT_MAX_TRACKED_KEYS entries so
// a flood of distinct keys (e.g. spoofed/rotating identifiers) cannot grow
// process memory without limit. See `makeRoomFor()` for the eviction
// strategy — it only ever evicts entries that are NOT currently locked out,
// so an attacker cannot use the flood to flush their own (or anyone else's)
// active lockout out of the map. Once no evictable room is available,
// unrecognized new keys collapse into a single shared overflow bucket,
// which still rate-limits them (just coarsely) rather than tracking them
// unboundedly or letting them slip through untracked.
const attempts = new Map<string, AttemptRecord>();
const OVERFLOW_KEY = "__overflow__";

function isStale(record: AttemptRecord, now: number): boolean {
  const lockoutOver = record.lockedUntil <= now;
  const windowOver = now - record.windowStart > PIN_RATE_LIMIT_WINDOW_MS;
  return lockoutOver && windowOver;
}

function isLocked(record: AttemptRecord, now: number): boolean {
  return record.lockedUntil > now;
}

/**
 * Opportunistic cleanup: removes entries that are fully stale (no active
 * lockout and outside their counting window). Runs on every read/write so
 * the map never accumulates garbage from one-off or expired clients.
 */
function sweepStale(now: number): void {
  for (const [key, record] of attempts) {
    if (key !== OVERFLOW_KEY && isStale(record, now)) {
      attempts.delete(key);
    }
  }
}

/**
 * Ensures there is room to insert a new key, evicting the oldest
 * non-locked entry if necessary. Never evicts a currently-locked entry or
 * the shared overflow bucket, so an attacker cannot game eviction to clear
 * a real lockout (theirs or anyone else's). Returns whether room is
 * available for a dedicated entry (false means the caller must fall back
 * to the overflow bucket).
 */
function makeRoomFor(key: string, now: number): boolean {
  if (attempts.has(key) || attempts.size < PIN_RATE_LIMIT_MAX_TRACKED_KEYS) {
    return true;
  }

  let oldestKey: string | undefined;
  let oldestWindowStart = Infinity;

  for (const [candidateKey, record] of attempts) {
    if (candidateKey === OVERFLOW_KEY || isLocked(record, now)) {
      continue;
    }
    if (record.windowStart < oldestWindowStart) {
      oldestWindowStart = record.windowStart;
      oldestKey = candidateKey;
    }
  }

  if (oldestKey === undefined) {
    return false;
  }

  attempts.delete(oldestKey);
  return true;
}

export type PinRateLimitStatus =
  | { limited: false }
  | { limited: true; retryAfterMs: number };

/**
 * Non-mutating mirror of `makeRoomFor()`'s eviction decision: returns
 * whether `key`, if it failed right now, would actually collapse into the
 * shared overflow bucket (map full AND no evictable — i.e. non-locked —
 * entry to make room for it). Used so the read path only attributes the
 * overflow bucket's lockout to keys that would truly land there, instead of
 * to every never-before-seen key.
 */
function wouldOverflow(key: string, now: number): boolean {
  if (attempts.has(key) || attempts.size < PIN_RATE_LIMIT_MAX_TRACKED_KEYS) {
    return false;
  }

  for (const [candidateKey, record] of attempts) {
    if (candidateKey === OVERFLOW_KEY || isLocked(record, now)) {
      continue;
    }
    return false;
  }

  return true;
}

/**
 * Checks whether `key` is currently locked out. Does not mutate state
 * beyond opportunistic stale-entry cleanup.
 */
export function checkPinRateLimit(key: string): PinRateLimitStatus {
  const now = Date.now();
  sweepStale(now);

  // Only fall back to the shared overflow bucket for keys that would
  // actually overflow into it (map full, no evictable slot available).
  // Otherwise an unrelated never-before-seen key would inherit an overflow
  // lockout it never contributed to — and since `recordPinSuccess()` can
  // never be reached while the check short-circuits with a 429, that key
  // could never clear itself, starving a legitimate user out indefinitely.
  const record = attempts.has(key)
    ? attempts.get(key)
    : wouldOverflow(key, now)
      ? attempts.get(OVERFLOW_KEY)
      : undefined;
  if (!record) {
    return { limited: false };
  }

  if (record.lockedUntil > now) {
    return { limited: true, retryAfterMs: record.lockedUntil - now };
  }

  return { limited: false };
}

/**
 * Records a failed PIN attempt for `key`. Once `PIN_RATE_LIMIT_MAX_ATTEMPTS`
 * failures occur inside a rolling `PIN_RATE_LIMIT_WINDOW_MS` window, the key
 * is locked out. Repeated lockouts escalate the lockout duration
 * exponentially, capped at `PIN_RATE_LIMIT_MAX_LOCKOUT_MS`.
 */
export function recordPinFailure(key: string): void {
  const now = Date.now();
  sweepStale(now);

  const effectiveKey = makeRoomFor(key, now) ? key : OVERFLOW_KEY;
  const record = attempts.get(effectiveKey);

  if (!record || now - record.windowStart > PIN_RATE_LIMIT_WINDOW_MS) {
    attempts.set(effectiveKey, {
      count: 1,
      windowStart: now,
      lockedUntil: 0,
      lockoutStrikes: record?.lockoutStrikes ?? 0,
    });
    return;
  }

  record.count += 1;

  if (record.count >= PIN_RATE_LIMIT_MAX_ATTEMPTS) {
    const lockoutDurationMs = Math.min(
      PIN_RATE_LIMIT_LOCKOUT_MS * 2 ** record.lockoutStrikes,
      PIN_RATE_LIMIT_MAX_LOCKOUT_MS,
    );
    record.lockedUntil = now + lockoutDurationMs;
    record.lockoutStrikes += 1;
    record.count = 0;
    record.windowStart = now;
  }
}

/**
 * Clears all rate-limit state for `key`. Call on a successful PIN
 * verification so a legitimate user isn't penalized by prior failures.
 * Does not clear the shared overflow bucket, since that state also
 * belongs to other, unrelated overflowed keys.
 */
export function recordPinSuccess(key: string): void {
  attempts.delete(key);
}

// --- Global limiter -------------------------------------------------------
//
// Defense-in-depth: caps TOTAL failed PIN attempts across ALL clients,
// independent of per-client key. See PIN_GLOBAL_RATE_LIMIT_MAX_ATTEMPTS in
// constants.ts for the full reasoning — in short, there is no
// attacker-proof per-client identifier available by default in this app, so
// this global cap is the backstop that makes brute-forcing the 10,000-PIN
// keyspace impractical even if per-client tracking is bypassed entirely.
// It's a single record, not a map, so it needs no bounding of its own.
let globalRecord: AttemptRecord = {
  count: 0,
  windowStart: 0,
  lockedUntil: 0,
  lockoutStrikes: 0,
};

export function checkGlobalPinRateLimit(): PinRateLimitStatus {
  const now = Date.now();
  if (globalRecord.lockedUntil > now) {
    return { limited: true, retryAfterMs: globalRecord.lockedUntil - now };
  }
  return { limited: false };
}

export function recordGlobalPinFailure(): void {
  const now = Date.now();

  // Decay: forgive accumulated strikes once a full window has passed with
  // no failures since the previous lockout expired. Without this,
  // `lockoutStrikes` only ever climbs, so a single ~20-request burst from
  // an anonymous, unauthenticated caller permanently escalates the global
  // lockout to its max (production defaults: 15m -> 30m -> 60m, forever) —
  // a worse outcome for the legitimate owner than the brute-force this
  // limiter defends against, since `recordGlobalPinSuccess()` (the only
  // thing that resets strikes) is unreachable while locked out (the global
  // check in the route runs before PIN verification).
  //
  // This function is only ever called after `checkGlobalPinRateLimit()` has
  // already confirmed we're not currently locked out, so by the time we get
  // here `globalRecord.lockedUntil` (if set) is always in the past — if
  // `now` is more than one window past it, that gap must have been silent
  // (a real failure during it would have been recorded and moved
  // `lockedUntil`/`windowStart` forward). A sustained attacker who keeps
  // failing right as each lockout expires never triggers this and keeps
  // escalating as intended; only a genuinely idle gap resets the strikes.
  if (
    globalRecord.lockoutStrikes > 0 &&
    now - globalRecord.lockedUntil > PIN_GLOBAL_RATE_LIMIT_WINDOW_MS
  ) {
    globalRecord = { count: 0, windowStart: 0, lockedUntil: 0, lockoutStrikes: 0 };
  }

  if (now - globalRecord.windowStart > PIN_GLOBAL_RATE_LIMIT_WINDOW_MS) {
    globalRecord = {
      count: 1,
      windowStart: now,
      lockedUntil: globalRecord.lockedUntil,
      lockoutStrikes: globalRecord.lockoutStrikes,
    };
    return;
  }

  globalRecord.count += 1;

  if (globalRecord.count >= PIN_GLOBAL_RATE_LIMIT_MAX_ATTEMPTS) {
    const lockoutDurationMs = Math.min(
      PIN_GLOBAL_RATE_LIMIT_LOCKOUT_MS * 2 ** globalRecord.lockoutStrikes,
      PIN_GLOBAL_RATE_LIMIT_MAX_LOCKOUT_MS,
    );
    globalRecord.lockedUntil = now + lockoutDurationMs;
    globalRecord.lockoutStrikes += 1;
    globalRecord.count = 0;
    globalRecord.windowStart = now;
  }
}

/**
 * Resets global failure tracking on a successful PIN verification, so a
 * legitimate user isn't penalized by unrelated prior failures once they've
 * proven who they are.
 */
export function recordGlobalPinSuccess(): void {
  globalRecord = { count: 0, windowStart: 0, lockedUntil: 0, lockoutStrikes: 0 };
}
