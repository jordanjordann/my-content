import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

/**
 * Proves `tests/setup/domMatchers.ts`'s `afterEach(cleanup)` actually runs
 * between jsdom tests (PR #126 review: `globals: false` silently disables
 * `@testing-library/react`'s own auto-cleanup registration, since it only
 * self-registers when `afterEach` is a GLOBAL). Two tests, deliberately
 * ordered so the second one would see the first test's leftover DOM if
 * cleanup didn't run.
 */
describe("RTL cleanup between tests (tests/setup/domMatchers.ts)", () => {
  it("mounts a marker element in the first test", () => {
    render(<div data-testid="cleanup-marker">first test&apos;s tree</div>);

    expect(screen.getByTestId("cleanup-marker")).toBeInTheDocument();
  });

  it("starts from a clean document with no leftover marker from the previous test", () => {
    // If afterEach(cleanup) hadn't run after the previous test, the first test's
    // <div data-testid="cleanup-marker"> would still be attached to document.body here.
    expect(screen.queryByTestId("cleanup-marker")).not.toBeInTheDocument();
    expect(document.body.childElementCount).toBe(0);

    render(<div data-testid="cleanup-marker">second test&apos;s tree</div>);

    expect(screen.getByTestId("cleanup-marker")).toHaveTextContent("second test's tree");
  });
});
