import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useIsBelowBreakpoint } from "@/lib/hooks/useIsBelowBreakpoint";
import { installMatchMediaStub } from "@/tests/setup/matchMediaStub";

/**
 * Ticket #334 / TDD #284 §4, §7.1, §7.2. Every assertion here exercises real
 * hook behaviour via `renderHook` against the shared `matchMediaStub` — no
 * source-text greps, no assertions that merely re-derive their own expected
 * value from the production constant.
 */

let stub: ReturnType<typeof installMatchMediaStub> | undefined;

afterEach(() => {
  stub?.restore();
  stub = undefined;
});

describe("useIsBelowBreakpoint", () => {
  it("queries the exact literal media-query string for lg", () => {
    stub = installMatchMediaStub();

    renderHook(() => useIsBelowBreakpoint("lg"));

    expect(stub.queries).toEqual(["(max-width: 1023.98px)"]);
  });

  it("queries the exact literal media-query string for sm, md, and lg, in order", () => {
    stub = installMatchMediaStub();

    renderHook(() => useIsBelowBreakpoint("sm"));
    renderHook(() => useIsBelowBreakpoint("md"));
    renderHook(() => useIsBelowBreakpoint("lg"));

    expect(stub.queries).toEqual([
      "(max-width: 639.98px)",
      "(max-width: 767.98px)",
      "(max-width: 1023.98px)",
    ]);
  });

  it("returns literal false on the very first render, even when the stub is pre-set to match", () => {
    stub = installMatchMediaStub();
    const query = "(max-width: 1023.98px)";

    // Pre-register the query as matching before the hook ever renders, so a
    // mutation that seeds state synchronously from `matchMedia().matches`
    // would observe `true` on first render instead of the required `false`.
    stub.setMatches(query, false);

    const { result } = renderHook(() => useIsBelowBreakpoint("lg"));

    expect(result.current).toBe(false);

    act(() => {
      stub!.setMatches(query, true);
    });

    expect(result.current).toBe(true);
  });

  it("updates to true when the media query starts matching", () => {
    stub = installMatchMediaStub();
    const query = "(max-width: 1023.98px)";

    const { result } = renderHook(() => useIsBelowBreakpoint("lg"));

    act(() => {
      stub!.setMatches(query, true);
    });

    expect(result.current).toBe(true);
  });

  it("updates to false when the media query stops matching", () => {
    stub = installMatchMediaStub();
    const query = "(max-width: 1023.98px)";

    const { result } = renderHook(() => useIsBelowBreakpoint("lg"));

    act(() => {
      stub!.setMatches(query, true);
    });
    expect(result.current).toBe(true);

    act(() => {
      stub!.setMatches(query, false);
    });
    expect(result.current).toBe(false);
  });

  it("removes its change listener on unmount", () => {
    stub = installMatchMediaStub();
    const query = "(max-width: 1023.98px)";

    const { unmount } = renderHook(() => useIsBelowBreakpoint("lg"));

    expect(stub.listenerCount(query)).toBe(1);

    unmount();

    expect(stub.listenerCount(query)).toBe(0);
  });

  it("returns false and does not throw when window.matchMedia is unavailable", () => {
    const originalMatchMedia = window.matchMedia;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).matchMedia;

    let hookResult: { current: boolean } | undefined;

    expect(() => {
      hookResult = renderHook(() => useIsBelowBreakpoint("lg")).result;
    }).not.toThrow();

    expect(hookResult?.current).toBe(false);

    window.matchMedia = originalMatchMedia;
  });
});
