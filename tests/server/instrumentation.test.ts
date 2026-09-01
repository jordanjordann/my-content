import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F3 (#244 review): `instrumentation.ts` had zero coverage. `process.exit(1)`
 * is the highest-value line in the file — found by hand in Docker, not in
 * the ticket design — and nothing stopped a future cleanup from deleting it.
 * PR #257 briefly split the guard into three files to (wrongly) avoid an
 * Edge Runtime bundling warning; a second review round found the split was
 * unnecessary (a differential build showed the positive `NEXT_RUNTIME`
 * check alone is enough — see `instrumentation.ts`) and introduced a real,
 * reproducible silent-hang failure mode (a chunk on the fallback path could
 * itself go missing). This suite pins the single-file, single-boundary
 * version:
 *   (a) the early return when `NEXT_RUNTIME !== "nodejs"` — no import, no
 *       exit.
 *   (b) no exit when `assertProductionEnv` returns normally.
 *   (c) `process.exit(1)` (via `writeSync(2, ...)`) when `assertProductionEnv`
 *       throws.
 *   (d) `process.exit(1)` when the dynamic `import` of `productionEnv`
 *       itself rejects — the #241 tracing failure mode.
 *
 * Proven by mutation: removing the `catch` block in `instrumentation.ts`
 * turns (c) and (d) red (the rejection becomes an unhandled promise
 * rejection instead of a caught, asserted exit).
 *
 * #313 boot-integration cases added below:
 *   (e) the stranded-pending reaper runs on a normal (nodejs, env-valid) boot.
 *   (f) a reaper failure is caught and logged, and does NOT call
 *       `process.exit` — a cosmetic row-status failure must never crash boot.
 *   (g) the reaper is never invoked when NEXT_RUNTIME is not nodejs.
 *   (h) the reaper is never invoked when the env guard already exited —
 *       pins the `return` added right after `process.exit(1)` in the env
 *       guard's catch block.
 */

const assertProductionEnv = vi.fn();
const writeSync = vi.fn();
const reapStrandedAnalyses = vi.fn();

vi.mock("@/lib/server/env/productionEnv", () => ({
  assertProductionEnv: (...args: unknown[]) => assertProductionEnv(...args),
}));

vi.mock("node:fs", () => ({
  writeSync: (...args: unknown[]) => writeSync(...args),
}));

// #313 — mocked so these tests never touch a real database. The reaper's
// own behavior (thresholds, guarded UPDATE, idempotency) is covered by
// tests/server/analysis/reaper/reaper.test.ts against a real /tmp file: DB;
// this file only proves `register()` wires it in correctly and never lets a
// reaper failure crash the boot.
vi.mock("@/lib/server/analysis/reaper", () => ({
  reapStrandedAnalyses: (...args: unknown[]) => reapStrandedAnalyses(...args),
}));

describe("register", () => {
  let originalRuntime: string | undefined;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalRuntime = process.env.NEXT_RUNTIME;
    assertProductionEnv.mockReset();
    writeSync.mockReset();
    reapStrandedAnalyses.mockReset();
    reapStrandedAnalyses.mockResolvedValue({ reaped: 0 });
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.env.NEXT_RUNTIME = originalRuntime;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("does not import the guard or exit when NEXT_RUNTIME is not nodejs", async () => {
    process.env.NEXT_RUNTIME = "edge";
    const { register } = await import("@/instrumentation");

    await register();

    expect(assertProductionEnv).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("does not exit when assertProductionEnv returns normally", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    assertProductionEnv.mockImplementation(() => undefined);
    const { register } = await import("@/instrumentation");

    await register();

    expect(assertProductionEnv).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("exits with code 1 via a flush-safe writeSync when assertProductionEnv throws", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const error = new Error("Invalid production environment:\nTURSO_DATABASE_URL is unset.");
    assertProductionEnv.mockImplementation(() => {
      throw error;
    });
    const { register } = await import("@/instrumentation");

    await register();

    expect(writeSync).toHaveBeenCalledWith(2, expect.stringContaining(error.message));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("(#313) runs the stranded-pending reaper on a normal boot", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    assertProductionEnv.mockImplementation(() => undefined);
    reapStrandedAnalyses.mockResolvedValue({ reaped: 2 });
    const { register } = await import("@/instrumentation");

    await register();

    expect(reapStrandedAnalyses).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  // MUTATION: deleting the reaper's own try/catch in instrumentation.ts and
  // letting a rejected reapStrandedAnalyses() propagate turns this test red
  // (the rejection would either crash register() or trigger an unrelated
  // exit) instead of boot completing normally.
  it("(#313) MUTATION: a reaper failure is caught and logged, and never calls process.exit", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    assertProductionEnv.mockImplementation(() => undefined);
    reapStrandedAnalyses.mockRejectedValue(new Error("db unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { register } = await import("@/instrumentation");

    await expect(register()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("(#313) does not invoke the reaper when NEXT_RUNTIME is not nodejs", async () => {
    process.env.NEXT_RUNTIME = "edge";
    const { register } = await import("@/instrumentation");

    await register();

    expect(reapStrandedAnalyses).not.toHaveBeenCalled();
  });

  // MUTATION: pins the `return` added right after `process.exit(1)` in the
  // env guard's catch block. Deleting that `return` turns this test red —
  // with `process.exit` mocked (as it must be in-process here), execution
  // would otherwise fall through into the reaper block on a boot the env
  // guard already deemed fatal.
  it("(#313) MUTATION: does not invoke the reaper when the env guard already exited", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    assertProductionEnv.mockImplementation(() => {
      throw new Error("Invalid production environment");
    });
    const { register } = await import("@/instrumentation");

    await register();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(reapStrandedAnalyses).not.toHaveBeenCalled();
  });

  // Kept LAST in this describe block: `vi.doMock` registers a module
  // override that survives `vi.resetModules()` (resetModules only clears
  // the resolved-module cache, not the mock registry), so it would leak
  // into every test declared after it in this file if placed earlier.
  it("exits with code 1 when the dynamic import of productionEnv itself rejects (#241)", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    vi.doMock("@/lib/server/env/productionEnv", () => {
      throw new Error("Cannot find module '@/lib/server/env/productionEnv'");
    });
    const { register } = await import("@/instrumentation");

    await register();

    expect(writeSync).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
