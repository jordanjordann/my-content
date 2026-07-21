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
