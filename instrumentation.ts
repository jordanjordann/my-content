/**
 * Production boot guard (#244). `register()` is called once when a new
 * Next.js server instance is initiated and must complete before the server
 * is ready to handle requests (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md).
 * That makes it the right place for a fail-fast environment check — it runs
 * at boot, never during `next build`. See `lib/server/env/productionEnv.ts`
 * for why the guard does NOT live in `lib/server/db.ts`.
 *
 * All Node-only code (`process.exit`, `node:fs`) lives inline below, guarded
 * by a POSITIVE `if (process.env.NEXT_RUNTIME === "nodejs")` block — do NOT
 * rewrite this as a negated early return (`if (... !== "nodejs") return;`).
 * That shape is what caused PR #257's Edge Runtime warning in the first
 * place: this project builds with Turbopack (not webpack), and Turbopack
 * constant-folds `NEXT_RUNTIME` and dead-code-eliminates the positive `if`
 * block *before* its Edge-chunk Node-API scan runs, so nothing inside it is
 * ever seen by that scan. A negated early return leaves the Node-only code
 * at the function's top level, where no such elimination happens, and the
 * scan flags it. Verified with a differential build (control: negated
 * early-return form reproduces the warning; positive-`if` form does not,
 * and the emitted Edge chunk contains no `process.exit`/`node:fs`
 * reference at all) — this is Turbopack's own behaviour, not something
 * documented by Next; do not re-derive a three-file split around a
 * scanner-reachability theory, it isn't how Turbopack's DCE works here.
 *
 * `process.exit(1)`, not `throw`: verified against a real `docker run`
 * (#244) that a thrown/rejected `register()` is only logged by Next's
 * standalone `server.js` ("Failed to prepare server" / `unhandledRejection`)
 * — the container stays "Up" and every request 500s forever instead of the
 * container exiting. Exit explicitly so the container actually stops.
 *
 * `fs.writeSync(2, ...)` before `process.exit(1)`, not `console.error`: on
 * piped stderr (Docker/Railway, not a local TTY), `console.error`'s write is
 * async and `process.exit()` does not wait for it to flush, which can leave
 * "exit 1, no reason given" in the logs. `writeSync` is a blocking syscall,
 * so the message is guaranteed to have left the process before exit.
 * Verified with stderr piped through `cat` (non-TTY) against the real
 * standalone `server.js` — the full message arrives intact.
 *
 * #313 / #280 — the stranded-`pending`-analysis reaper also runs here, in
 * the SAME positive `NEXT_RUNTIME === "nodejs"` block (not a new one — see
 * the Turbopack note above). Crucial difference from the env guard above:
 * the reaper must NEVER `process.exit()`. It is wrapped in its own
 * try/catch that logs and swallows — a reaper failure (a cosmetic row
 * status) must not prevent the server from booting. `register()` must
 * complete before requests are served, so the sweep is a single fast
 * `UPDATE` statement.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { assertProductionEnv } = await import("./lib/server/env/productionEnv");
      assertProductionEnv();
    } catch (error) {
      const { writeSync } = await import("node:fs");
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
      writeSync(2, `${message}\n`);
      process.exit(1);
      // `process.exit` never returns in production. This `return` exists so
      // a test-mocked `process.exit` (which DOES return) can't fall through
      // into the reaper block below and hit a real database.
      return;
    }

    try {
      const { reapStrandedAnalyses } = await import("./lib/server/analysis/reaper");
      const { reaped } = await reapStrandedAnalyses();
      if (reaped > 0) {
        console.log(`reaper: marked ${reaped} stranded pending analysis row(s) as failed`);
      }
    } catch (error) {
      console.error("reaper: failed to sweep stranded pending analyses", error);
    }
  }
}
