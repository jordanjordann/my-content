import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #241 tracing failure mode, split into its own file (round-2 fix on PR
 * #314's P2(b)).
 *
 * Mocking shape for `@/lib/server/env/productionEnv`: it is registered with
 * exactly ONE hoisted `vi.mock`, whose factory reads a mutable
 * `productionEnvImportShouldFail` flag. The test that needs the import to
 * fail flips that flag instead of registering a second, competing mock for
 * the same path via `vi.doMock`. This is deliberate, not incidental:
 * Vitest 4.1.10's `resolveMocks` resolves consecutive same-action
 * mock-queue entries for the SAME module path in parallel (`Promise.all`),
 * and the registry ends up with whichever `resolveId()` settles last
 * (last-writer-wins). A hoisted `vi.mock` plus an in-test `vi.doMock` for
 * that same path therefore raced each other non-deterministically (~40%
 * failure rate reproduced in isolation, always manifesting as
 * `writeSync` "expected 1, got 0" because the harmless hoisted mock won the
 * race instead of the throwing one). Do not reintroduce a second
 * `vi.mock`/`vi.doMock` for `@/lib/server/env/productionEnv` in this file.
 *
 * The general `vi.doMock` leakage warning below still applies to this file
 * as a whole (it no longer applies to `productionEnv` specifically, since
 * that path is no longer doMock'd):
 *
 * `vi.doMock`, in general, registers a module override that survives
 * `vi.resetModules()` (`resetModules` only clears the resolved-module
 * cache, not the mock registry). Living in the same file as
 * `instrumentation.test.ts`'s other `register()` tests -- even "kept last in
 * the describe block" -- was a tripwire, not a fix: any test appended after
 * it in that file would silently get `assertProductionEnv` never actually
 * called (the overridden module throws on import instead), turning a real
 * assertion failure into "0 calls expected, 0 calls got" for the wrong
 * reason (the register() call short-circuits into the env-guard's exit path
 * before ever reaching the real assertProductionEnv). `vi.doUnmock` in an
 * `afterEach` does NOT fix this either -- it strips the override entirely,
 * including the file's own hoisted `vi.mock`, so the following test would
 * import the REAL, unmocked module rather than falling back to the mock
 * (verified in this session by running the reduced repro; the "after" test
 * failed with `assertProductionEnv` called 0 times because the real
 * production-env implementation naturally doesn't call the test's spy).
 *
 * A separate file is the actual fix: Vitest's default `isolate: true` gives
 * every test file its own module registry, so a `vi.doMock` call here can
 * never reach any test declared anywhere else, regardless of file or
 * declaration order.
 *
 * Keep this file to exactly this one test. The isolation this file buys you
 * is FILE-level, not test-level -- a second test appended below this one,
 * in this same file, would still inherit the leaked `vi.doMock` override
 * (the underlying problem this whole comment describes). Any other
 * `register()` behaviour belongs in `instrumentation.test.ts`.
 */

const assertProductionEnv = vi.fn();
const writeSync = vi.fn();
const reapStrandedAnalyses = vi.fn();

let productionEnvImportShouldFail = false;

vi.mock("@/lib/server/env/productionEnv", () => {
  if (productionEnvImportShouldFail) {
    throw new Error("Cannot find module '@/lib/server/env/productionEnv'");
  }
  return {
    assertProductionEnv: (...args: unknown[]) => assertProductionEnv(...args),
  };
});

vi.mock("node:fs", () => ({
  writeSync: (...args: unknown[]) => writeSync(...args),
}));

vi.mock("@/lib/server/analysis/reaper", () => ({
  reapStrandedAnalyses: (...args: unknown[]) => reapStrandedAnalyses(...args),
}));

describe("register - dynamic import failure (#241)", () => {
  let originalRuntime: string | undefined;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalRuntime = process.env.NEXT_RUNTIME;
    productionEnvImportShouldFail = false;
    assertProductionEnv.mockReset();
    writeSync.mockReset();
    reapStrandedAnalyses.mockReset();
    reapStrandedAnalyses.mockResolvedValue({ reaped: 0 });
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.env.NEXT_RUNTIME = originalRuntime;
    productionEnvImportShouldFail = false;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("exits with code 1 when the dynamic import of productionEnv itself rejects (#241)", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    productionEnvImportShouldFail = true;
    const { register } = await import("@/instrumentation");

    await register();

    expect(writeSync).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
