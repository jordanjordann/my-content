export const PIN_HASH_KEY = "pin_hash";
export const PIN_SET_AT_KEY = "pin_set_at";
export const AUTH_COOKIE_NAME = "my_content_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export const authCookieOptions = {
  httpOnly: true,
  maxAge: SESSION_TTL_SECONDS,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

function resolvePositiveIntEnv(envVar: string, defaultValue: number): number {
  const raw = process.env[envVar];
  if (raw === undefined || raw === "") {
    return defaultValue;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid ${envVar} env var: "${raw}" is not a positive finite number. ` +
        `Unset it to use the default (${defaultValue}) or provide a valid positive integer.`,
    );
  }

  return parsed;
}

function resolveBooleanEnv(envVar: string, defaultValue: boolean): boolean {
  const raw = process.env[envVar];
  if (raw === undefined || raw === "") {
    return defaultValue;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }

  throw new Error(
    `Invalid ${envVar} env var: "${raw}" is not a valid boolean. ` +
      `Unset it to use the default (${defaultValue}) or provide "true"/"false".`,
  );
}

const DEFAULT_PIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const DEFAULT_PIN_RATE_LIMIT_WINDOW_MS = 5 * 60_000; // 5 minutes
const DEFAULT_PIN_RATE_LIMIT_LOCKOUT_MS = 5 * 60_000; // initial lockout: 5 minutes
const DEFAULT_PIN_RATE_LIMIT_MAX_LOCKOUT_MS = 30 * 60_000; // cap: 30 minutes

// Max failed PIN attempts allowed within the rolling window before lockout.
export const PIN_RATE_LIMIT_MAX_ATTEMPTS = resolvePositiveIntEnv(
  "PIN_RATE_LIMIT_MAX_ATTEMPTS",
  DEFAULT_PIN_RATE_LIMIT_MAX_ATTEMPTS,
);

// Rolling window (ms) in which failed attempts are counted.
export const PIN_RATE_LIMIT_WINDOW_MS = resolvePositiveIntEnv(
  "PIN_RATE_LIMIT_WINDOW_MS",
  DEFAULT_PIN_RATE_LIMIT_WINDOW_MS,
);

// Initial lockout duration (ms) once the attempt threshold is hit.
export const PIN_RATE_LIMIT_LOCKOUT_MS = resolvePositiveIntEnv(
  "PIN_RATE_LIMIT_LOCKOUT_MS",
  DEFAULT_PIN_RATE_LIMIT_LOCKOUT_MS,
);

// Upper bound (ms) for the exponentially escalating lockout duration.
export const PIN_RATE_LIMIT_MAX_LOCKOUT_MS = resolvePositiveIntEnv(
  "PIN_RATE_LIMIT_MAX_LOCKOUT_MS",
  DEFAULT_PIN_RATE_LIMIT_MAX_LOCKOUT_MS,
);

// Whether to trust the `X-Forwarded-For` header for per-client rate-limit
// keying. This app runs as a bare `next start`/`next dev` Node process with
// no reverse proxy in front by default — in that mode `X-Forwarded-For` is
// pure attacker-controlled input (any client can set it to any value) and
// trusting it lets an attacker mint unlimited fresh rate-limit buckets by
// rotating the header per request, fully bypassing per-client lockout.
//
// Only flip this on if this app is deployed behind a reverse proxy /
// load balancer that is configured to strip any client-supplied
// `X-Forwarded-For` and overwrite it with the real, verified peer address
// (e.g. nginx `proxy_set_header X-Forwarded-For $remote_addr`, or a cloud
// load balancer that does the same). If that isn't true, leave this unset.
export const TRUST_PROXY_HEADERS = resolveBooleanEnv("TRUST_PROXY_HEADERS", false);

// Hard cap on the number of distinct rate-limit keys tracked at once. This
// bounds the in-memory Map so that spoofed/rotating client identifiers (e.g.
// forged `X-Forwarded-For` values when TRUST_PROXY_HEADERS is on, behind a
// misconfigured or compromised proxy) cannot grow process memory without
// limit. See rateLimiter.ts for the eviction strategy that keeps this safe
// against an attacker trying to flush their own lockout by filling the map.
export const PIN_RATE_LIMIT_MAX_TRACKED_KEYS = resolvePositiveIntEnv(
  "PIN_RATE_LIMIT_MAX_TRACKED_KEYS",
  1000,
);

const DEFAULT_PIN_GLOBAL_RATE_LIMIT_MAX_ATTEMPTS = 20;
const DEFAULT_PIN_GLOBAL_RATE_LIMIT_WINDOW_MS = 10 * 60_000; // 10 minutes
const DEFAULT_PIN_GLOBAL_RATE_LIMIT_LOCKOUT_MS = 15 * 60_000; // initial lockout: 15 minutes
const DEFAULT_PIN_GLOBAL_RATE_LIMIT_MAX_LOCKOUT_MS = 60 * 60_000; // cap: 1 hour

// Defense-in-depth: a cap on TOTAL failed PIN attempts across ALL clients
// (independent of per-client key), because per-client identity may not be
// reliable — there is no attacker-proof client IP available in this Next.js
// version without a trusted proxy (see TRUST_PROXY_HEADERS above), so a
// per-client-only limit can in principle be evaded by varying the client
// identifier. This app is effectively single-user (a personal tool guarded
// by a 4-digit PIN, no legitimate multi-client concurrent usage), so a
// global cap on failures has no real cost to a genuine user and makes
// brute-forcing the full 10,000-PIN keyspace prohibitively slow even if
// per-client tracking is bypassed. The threshold is set well above what one
// person fat-fingering their own PIN a few times would ever hit.
export const PIN_GLOBAL_RATE_LIMIT_MAX_ATTEMPTS = resolvePositiveIntEnv(
  "PIN_GLOBAL_RATE_LIMIT_MAX_ATTEMPTS",
  DEFAULT_PIN_GLOBAL_RATE_LIMIT_MAX_ATTEMPTS,
);

// Rolling window (ms) in which failed attempts are counted, globally.
export const PIN_GLOBAL_RATE_LIMIT_WINDOW_MS = resolvePositiveIntEnv(
  "PIN_GLOBAL_RATE_LIMIT_WINDOW_MS",
  DEFAULT_PIN_GLOBAL_RATE_LIMIT_WINDOW_MS,
);

// Initial lockout duration (ms) once the global attempt threshold is hit.
export const PIN_GLOBAL_RATE_LIMIT_LOCKOUT_MS = resolvePositiveIntEnv(
  "PIN_GLOBAL_RATE_LIMIT_LOCKOUT_MS",
  DEFAULT_PIN_GLOBAL_RATE_LIMIT_LOCKOUT_MS,
);

// Upper bound (ms) for the exponentially escalating global lockout duration.
export const PIN_GLOBAL_RATE_LIMIT_MAX_LOCKOUT_MS = resolvePositiveIntEnv(
  "PIN_GLOBAL_RATE_LIMIT_MAX_LOCKOUT_MS",
  DEFAULT_PIN_GLOBAL_RATE_LIMIT_MAX_LOCKOUT_MS,
);
