import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F3 (#244 review): `instrumentation.ts` had zero coverage. `process.exit(1)`
 * is the highest-value line in this guard — found by hand in Docker, not in
 * the ticket design — and nothing stopped a future cleanup from deleting it.
 * PR #257 split the guard body into `instrumentation-node.ts` (reached via a
 * conditional dynamic `import()`, to keep `process.exit` out of the Edge
 * Runtime bundle of `instrumentation.ts`); this file follows that split, and
 * a B1 follow-up added `instrumentation-node-exit.ts` as the shared,
 * flush-safe exit path used by both `instrumentation.ts`'s own outer
 * `import("./instrumentation-node")` failure and `instrumentation-node.ts`'s
 * inner `assertProductionEnv` failure. This pins:
 *   (a) the early return on `NEXT_RUNTIME !== "nodejs"` — no import, no exit.
 *   (b) no exit when `registerNode()` (via `assertProductionEnv`) returns
 *       normally.
 *   (c) exit via `exitWithBootFailure` when `assertProductionEnv` throws
 *       (the inner `instrumentation-node.ts` try/catch).
 *   (d) F2/B1: exit via `exitWithBootFailure` when the dynamic `import` of
 *       `./instrumentation-node` **itself** rejects — the #241 tracing
 *       failure mode, now guarded at the outer boundary in
 *       `instrumentation.ts` rather than only the inner one.
 *   (e) B1: exit via `exitWithBootFailure` when the dynamic `import` of
 *       `productionEnv` (the innermost hop, inside `instrumentation-node.ts`)
 *       rejects — the original #241 mode this suite already covered before
 *       the split, kept here as a regression pin.
 *
 * Proven by mutation: deleting the `catch` block in `instrumentation.ts`
 * turns (d) red (the rejection becomes an unhandled promise rejection
 * instead of a caught, asserted exit); deleting the `catch` in
 * `instrumentation-node.ts` turns (c) and (e) red the same way.
 */

const assertProductionEnv = vi.fn();
const exitWithBootFailure = vi.fn();

vi.mock("@/lib/server/env/productionEnv", () => ({
  assertProductionEnv: (...args: unknown[]) => assertProductionEnv(...args),
}));

vi.mock("@/instrumentation-node-exit", () => ({
  exitWithBootFailure: (...args: unknown[]) => exitWithBootFailure(...args),
}));

describe("register", () => {
  let originalRuntime: string | undefined;

  beforeEach(() => {
    originalRuntime = process.env.NEXT_RUNTIME;
    assertProductionEnv.mockReset();
    exitWithBootFailure.mockReset();
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
    expect(exitWithBootFailure).not.toHaveBeenCalled();
  });

  it("does not exit when assertProductionEnv returns normally", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    assertProductionEnv.mockImplementation(() => undefined);
    const { register } = await import("@/instrumentation");

    await register();

    expect(assertProductionEnv).toHaveBeenCalledTimes(1);
    expect(exitWithBootFailure).not.toHaveBeenCalled();
  });

  it("exits via exitWithBootFailure when assertProductionEnv throws", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const error = new Error("Invalid production environment:\nTURSO_DATABASE_URL is unset.");
    assertProductionEnv.mockImplementation(() => {
      throw error;
    });
    const { register } = await import("@/instrumentation");

    await register();

    expect(exitWithBootFailure).toHaveBeenCalledWith(error);
  });

  it("exits via exitWithBootFailure when the inner dynamic import of productionEnv rejects (e)", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    vi.doMock("@/lib/server/env/productionEnv", () => {
      throw new Error("Cannot find module '@/lib/server/env/productionEnv'");
    });
    const { register } = await import("@/instrumentation");

    await register();

    expect(exitWithBootFailure).toHaveBeenCalledTimes(1);
  });

  it("exits via exitWithBootFailure when the outer dynamic import of instrumentation-node rejects (d, B1)", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    vi.doMock("@/instrumentation-node", () => {
      throw new Error("Cannot find module '@/instrumentation-node'");
    });
    const { register } = await import("@/instrumentation");

    await register();

    expect(assertProductionEnv).not.toHaveBeenCalled();
    expect(exitWithBootFailure).toHaveBeenCalledTimes(1);
  });
});
