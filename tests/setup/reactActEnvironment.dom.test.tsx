import { describe, expect, it } from "vitest";

/**
 * Proves `tests/setup/domMatchers.ts` explicitly sets
 * `globalThis.IS_REACT_ACT_ENVIRONMENT = true` (PR #126 review, round 2):
 * `globals: false` on the `jsdom` project also silently disables the second
 * half of `@testing-library/react`'s auto-setup block (`beforeAll(() =>
 * setReactActEnvironment(true))`), since that registration is gated on the
 * same implicit `beforeAll`/`afterAll` globals that `afterEach(cleanup)` was.
 * Without it, React never warns about state updates performed outside
 * `act()` — a real regression class, not a cosmetic one.
 *
 * A direct assertion on the flag is preferred here over trying to trigger and
 * assert on React's internal "not wrapped in act" console.error text, which
 * is an implementation detail that can shift across React versions.
 */
describe("React act environment (tests/setup/domMatchers.ts)", () => {
  it("is set to true by the jsdom setup file, not left unset", () => {
    expect(globalThis.IS_REACT_ACT_ENVIRONMENT).toBe(true);
  });
});
