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
 */

const assertProductionEnv = vi.fn();
const writeSync = vi.fn();

vi.mock("@/lib/server/env/productionEnv", () => ({
  assertProductionEnv: (...args: unknown[]) => assertProductionEnv(...args),
}));

vi.mock("node:fs", () => ({
  writeSync: (...args: unknown[]) => writeSync(...args),
}));

describe("register", () => {
  let originalRuntime: string | undefined;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalRuntime = process.env.NEXT_RUNTIME;
    assertProductionEnv.mockReset();
    writeSync.mockReset();
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
