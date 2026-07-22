import { afterEach, beforeEach, vi } from "vitest";

/**
 * Global "offline by construction" guard (PR #81 review, blocker 1).
 *
 * Before this file existed, only `tests/server/scrapecreators/client.test.ts`
 * stubbed `fetch` — nothing stopped a future test from making a real,
 * credit-charged call by omission. ScrapeCreators is credit-based
 * (~25k credits remaining) and `/v1/youtube/channel` charges a credit **even
 * when the call fails** (see `.claude/context/verified-facts.md`).
 *
 * This installs a `fetch` stub before every test that THROWS, naming the
 * attempted URL, unless the test explicitly overrides it with its own
 * `vi.stubGlobal("fetch", ...)`. There is no way to make a live network call
 * from this suite by accident — a test must opt in per-test.
 *
 * Registered via `vitest.config.ts`'s `test.setupFiles`, so it applies to
 * every test file without each file having to import it.
 */

function describeFetchTarget(input: unknown): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (input instanceof Request) {
    return input.url;
  }
  return String(input);
}

function installLiveFetchGuard(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const target = describeFetchTarget(input);
      throw new Error(
        `[tests] Live fetch() blocked: an unstubbed call was attempted to "${target}". ` +
          "This suite is offline by construction (see docs/RUNBOOK.md §7 and " +
          "tests/fixtures/README.md). If this test genuinely needs fetch, stub it explicitly " +
          'with vi.stubGlobal("fetch", ...) using a committed fixture before exercising the code ' +
          "under test.",
      );
    }),
  );
}

beforeEach(() => {
  installLiveFetchGuard();
});

afterEach(() => {
  vi.unstubAllGlobals();
});
