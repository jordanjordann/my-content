import { exitWithBootFailure } from "./instrumentation-node-exit";

/**
 * Node.js-only half of the production boot guard (#244), split out of
 * `instrumentation.ts` (#247 follow-up, PR #257) so the Edge Runtime bundle
 * of `instrumentation.ts` never sees a Node-only API reference. See
 * `instrumentation.ts` for why the split exists and how it is reached — that
 * rationale is not repeated here to avoid two copies drifting apart.
 *
 * Exported as `registerNode()` rather than run as a bare module side effect:
 * a side-effect module only runs once per process (subsequent
 * `import()`s hit the module cache), which would have silently made this
 * guard non-idempotent versus the pre-split `instrumentation.ts` it was
 * copied from. `register()` is documented to run once per server instance
 * anyway, so this is currently a distinction without a difference — but an
 * exported function keeps that guarantee explicit rather than implicit, and
 * this file directly unit-testable (`tests/server/instrumentation.test.ts`)
 * without a module-cache workaround.
 *
 * `process.exit(1)` (not `throw`): verified against a real `docker run`
 * (#244) that a thrown/rejected `register()` is logged by Next's standalone
 * `server.js` ("Failed to prepare server" / `unhandledRejection`) but does
 * NOT terminate the process — the container stays "Up" and every request
 * 500s forever instead of the container exiting. Exit explicitly so the
 * container actually stops.
 *
 * The actual flush-safe exit (`fs.writeSync(2, ...)` then `process.exit(1)`,
 * not `console.error` + `process.exit(1)` — on piped stderr, Docker/Railway,
 * not a local TTY, `console.error`'s write is async and `process.exit()`
 * does not wait for pending writes to flush, which can leave "exit 1, no
 * reason given" in `docker logs`) lives in `./instrumentation-node-exit`,
 * shared with `instrumentation.ts`'s own fallback for when loading *this*
 * file fails. Verified with `docker logs` after the container exited,
 * piping through `cat` (non-TTY) rather than reading the terminal directly
 * — see PR body.
 */
export async function registerNode(): Promise<void> {
  try {
    const { assertProductionEnv } = await import("./lib/server/env/productionEnv");
    assertProductionEnv();
  } catch (error) {
    exitWithBootFailure(error);
  }
}
