/**
 * Production boot guard (#244, TDD §11.3a). Called from `instrumentation.ts`'s
 * `register()` — NOT imported at module scope by `lib/server/db.ts` or any
 * route handler. `next build` runs with `NODE_ENV=production` and
 * deliberately without `TURSO_DATABASE_URL` (both `.github/workflows/ci.yml`
 * and the Dockerfile's builder stage), so a module-scope throw in `db.ts`
 * would break every build. `register()` runs once at server boot, after the
 * build has already completed, so it can be strict without that risk.
 *
 * Collects every problem and throws ONCE with all of them listed — an
 * operator should learn about N missing vars from one log line, not N deploy
 * cycles.
 */

const PRODUCTION_ENV_ERROR_PREFIX = "Invalid production environment:";

export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") {
    return;
  }

  const problems: string[] = [];

  const turso = env.TURSO_DATABASE_URL;
  if (!turso) {
    problems.push(
      "TURSO_DATABASE_URL is unset. lib/server/db.ts falls back to " +
        '"file:./my-content.db" — an ephemeral file inside the container ' +
        "filesystem — and every write is silently lost on the next redeploy.",
    );
  } else if (turso.startsWith("file:")) {
    problems.push(
      "TURSO_DATABASE_URL is set to a local file URL. This is the same bug " +
        "as leaving it unset: writes go to the ephemeral container " +
        "filesystem and are silently lost on the next redeploy.",
    );
  } else if (
    (turso.startsWith("libsql://") || turso.startsWith("https://")) &&
    !env.TURSO_AUTH_TOKEN
  ) {
    problems.push(
      "TURSO_AUTH_TOKEN is unset. TURSO_DATABASE_URL is a remote libSQL " +
        "URL, which requires an auth token to connect.",
    );
  }

  if (!env.APP_SESSION_SECRET) {
    problems.push(
      "APP_SESSION_SECRET is unset. lib/server/auth/auth.ts:96-107 will throw " +
        "on the first authenticated request.",
    );
  }

  if (env.RESET_PIN === "true") {
    problems.push(
      'RESET_PIN is set to "true". Every hasPinConfigured() call wipes the ' +
        "configured PIN (see .env.example:12-15) — this must never be true in " +
        "production.",
    );
  }

  if (problems.length > 0) {
    throw new Error(`${PRODUCTION_ENV_ERROR_PREFIX}\n${problems.join("\n")}`);
  }
}
