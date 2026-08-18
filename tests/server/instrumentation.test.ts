import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F3 (#244 review): `instrumentation.ts` had zero coverage. `process.exit(1)`
 * is the highest-value line in the file — found by hand in Docker, not in
 * the ticket design — and nothing stopped a future cleanup from deleting it.
 * This pins:
 *   (a) the early return on `NEXT_RUNTIME !== "nodejs"` — no import, no exit.
 *   (b) no exit when `assertProductionEnv` returns normally.
 *   (c) `process.exit(1)` when `assertProductionEnv` throws.
 *   (d) F2: `process.exit(1)` when the dynamic `import` itself rejects — the
 *       #241 tracing failure mode the `try` was widened to cover.
 *
 * Proven by mutation: deleting `process.exit(1)` from `instrumentation.ts`
 * turns (c) and (d) red; moving the `await import` back outside the `try`
 * turns (d) red (the rejection becomes an unhandled promise rejection
 * instead of a caught, asserted `process.exit(1)` call).
 */

const assertProductionEnv = vi.fn();

vi.mock("@/lib/server/env/productionEnv", () => ({
  assertProductionEnv: (...args: unknown[]) => assertProductionEnv(...args),
}));

describe("register", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let originalRuntime: string | undefined;

  beforeEach(() => {
    originalRuntime = process.env.NEXT_RUNTIME;
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    assertProductionEnv.mockReset();
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

  it("exits with code 1 when assertProductionEnv throws", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const error = new Error("Invalid production environment:\nTURSO_DATABASE_URL is unset.");
    assertProductionEnv.mockImplementation(() => {
      throw error;
    });
    const { register } = await import("@/instrumentation");

    await register();

    expect(errorSpy).toHaveBeenCalledWith(error);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when the dynamic import of the guard module rejects (F2)", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    vi.doMock("@/lib/server/env/productionEnv", () => {
      throw new Error("Cannot find module '@/lib/server/env/productionEnv'");
    });
    const { register } = await import("@/instrumentation");

    await register();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
