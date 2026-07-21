import {
  PIN_RATE_LIMIT_LOCKOUT_MS,
  PIN_RATE_LIMIT_MAX_ATTEMPTS,
  PIN_RATE_LIMIT_MAX_LOCKOUT_MS,
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
const attempts = new Map<string, AttemptRecord>();

export type PinRateLimitStatus =
  | { limited: false }
  | { limited: true; retryAfterMs: number };

/**
 * Checks whether `key` is currently locked out. Does not mutate state.
 */
export function checkPinRateLimit(key: string): PinRateLimitStatus {
  const record = attempts.get(key);
  if (!record) {
    return { limited: false };
  }

  const now = Date.now();
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
  const record = attempts.get(key);

  if (!record || now - record.windowStart > PIN_RATE_LIMIT_WINDOW_MS) {
    attempts.set(key, {
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
 */
export function recordPinSuccess(key: string): void {
  attempts.delete(key);
}
