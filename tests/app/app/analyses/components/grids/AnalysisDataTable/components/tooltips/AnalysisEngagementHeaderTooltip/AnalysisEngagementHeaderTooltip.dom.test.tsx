import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisEngagementHeaderTooltip } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/tooltips/AnalysisEngagementHeaderTooltip";
import {
  ENGAGEMENT_HEADER_TOOLTIP_BODY,
  ENGAGEMENT_HEADER_TOOLTIP_COMPARISON,
  ENGAGEMENT_HEADER_TOOLTIP_HEADING,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/components/tooltips/AnalysisEngagementHeaderTooltip/constants";

/**
 * Ticket #223 (3C-F4, DESIGN-3C §4.2 amendment A6 / DESIGN-3B §4.6 amendment B7) — the two
 * engagement column-header tooltips. R-D7's keyboard-focus path is exercised via the real
 * `.focus()` DOM method (not `fireEvent.focus`, which does not move `document.activeElement`
 * or engage jsdom's `:focus-visible` heuristic — verified against a throwaway probe before
 * writing this file).
 *
 * `focusByKeyboard` below dispatches a real (non-modifier) `keydown` ON THE TARGET itself
 * immediately before `.focus()`. jsdom's `:focus-visible` matcher
 * (`@asamuzakjp/dom-selector`) tracks input modality from global `window`-level listeners and
 * carries state ACROSS tests in the same file (e.g. a prior test's `mouseEnter` can leave a
 * later plain `.focus()` not matching `:focus-visible`) — a `keydown` whose `event.target`
 * is the about-to-be-focused element itself is the one branch of that heuristic verified (by
 * a throwaway probe) to match reliably regardless of what happened in earlier tests.
 */
function focusByKeyboard(element: HTMLElement) {
  fireEvent.keyDown(element, { key: "a" });
  element.focus();
}
describe("AnalysisEngagementHeaderTooltip — ticket #223", () => {
  it("(R-D8) the trigger's accessible name is the exact question for engagementReach", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementReach" />);
    expect(screen.getByRole("button", { name: "How is engagement against reach worked out?" })).toBeInTheDocument();
  });

  it("(R-D8) the trigger's accessible name is the exact question for engagementFollowers", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementFollowers" />);
    expect(
      screen.getByRole("button", { name: "How is engagement against followers worked out?" }),
    ).toBeInTheDocument();
  });

  it("(R-D7) opens on KEYBOARD FOCUS (not just click) and renders the full T1 text, role='tooltip'", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementReach" />);
    const trigger = screen.getByRole("button", { name: "How is engagement against reach worked out?" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    focusByKeyboard(trigger);
    expect(trigger.matches(":focus-visible")).toBe(true);
    fireEvent.focus(trigger);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
    expect(tooltip).toHaveTextContent(ENGAGEMENT_HEADER_TOOLTIP_HEADING.engagementReach);
    expect(tooltip).toHaveTextContent(ENGAGEMENT_HEADER_TOOLTIP_BODY.engagementReach);
    expect(tooltip).toHaveTextContent(ENGAGEMENT_HEADER_TOOLTIP_COMPARISON.engagementReach);
  });

  it("(R-D7) opens on hover too", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementFollowers" />);
    const trigger = screen.getByRole("button", { name: "How is engagement against followers worked out?" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("(R-D7) Escape dismisses", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementReach" />);
    const trigger = screen.getByRole("button", { name: "How is engagement against reach worked out?" });

    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("(R-D7) blur dismisses", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementReach" />);
    const trigger = screen.getByRole("button", { name: "How is engagement against reach worked out?" });

    focusByKeyboard(trigger);
    expect(trigger.matches(":focus-visible")).toBe(true);
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("(R-D7) outside press dismisses", () => {
    render(
      <div>
        <AnalysisEngagementHeaderTooltip columnId="engagementReach" />
        <button type="button">elsewhere</button>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "How is engagement against reach worked out?" });

    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    const elsewhere = screen.getByRole("button", { name: "elsewhere" });
    fireEvent.pointerDown(elsewhere);
    fireEvent.mouseDown(elsewhere);
    fireEvent.click(elsewhere);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("(R-D7) never renders a native title attribute anywhere", () => {
    const { container } = render(<AnalysisEngagementHeaderTooltip columnId="engagementReach" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "How is engagement against reach worked out?" }));
    expect(container.querySelector("[title]")).toBeNull();
  });

  it("(R-D10 / R-13.3.4) neither T1 nor T2 contains a digit", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementReach" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "How is engagement against reach worked out?" }));
    expect(screen.getByRole("tooltip").textContent).not.toMatch(/\d/);
  });

  it("(R-D10 / R-13.3.4, T2) neither string contains a digit for engagementFollowers either", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementFollowers" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "How is engagement against followers worked out?" }));
    expect(screen.getByRole("tooltip").textContent).not.toMatch(/\d/);
  });

  it("(§4.6) T2's full body and matched closing sentence render byte-identically to the design doc", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementFollowers" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "How is engagement against followers worked out?" }));
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent(ENGAGEMENT_HEADER_TOOLTIP_HEADING.engagementFollowers);
    expect(tooltip).toHaveTextContent(ENGAGEMENT_HEADER_TOOLTIP_BODY.engagementFollowers);
    expect(tooltip).toHaveTextContent(ENGAGEMENT_HEADER_TOOLTIP_COMPARISON.engagementFollowers);
  });

  /**
   * The tests above import their expectations from the SAME `constants.ts` the component
   * renders from — a corruption of a copy string there would satisfy both the component and
   * the assertion identically, so those tests alone cannot catch copy drift (verified by
   * mutation-testing the trigger deliberately during this ticket's own review). These two
   * tests hardcode DESIGN-3B §4.6's T1/T2 strings literally, independent of the constants
   * module, so a corrupted constant fails here even though the self-referential tests above
   * would not catch it.
   *
   * `toHaveTextContent` is a SUBSTRING match, so it only catches shrinkage/substitution, never
   * appended or prepended text (e.g. a corrupted denominator of "…on this post, estimated"
   * still satisfies `toHaveTextContent("…on this post")`). Each of the three `<p>` elements
   * rendered by the Popup (`:scope > p` — heading, body, closing sentence; the operand pair
   * lives in a sibling `<div>` and is not a direct `<p>` child) contains exactly one text
   * expression and no other child, so `.textContent` is the string with no incidental
   * whitespace to normalise — `toBe` on `.textContent` is therefore an exact-equality guard
   * with no false positives from formatting.
   *
   * Exact equality on each pinned string does not pin how MANY strings the Popup renders — a
   * fourth `<p>` appended after the closing sentence (e.g. invented copy contradicting T1's
   * own "not estimates" sentence) still lets the destructure below take only the first three,
   * which are still correct, so the assertions alone would not notice. `toHaveLength(3)`
   * BEFORE the destructure pins the element set, not just its first three members, and makes
   * the positional `[heading, body, comparison]` indexing fail loudly (a `TypeError`) rather
   * than silently passing if the structure ever changes.
   */
  it("(§4.6, literal) T1 renders DESIGN-3B's exact hardcoded copy, independent of constants.ts", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementReach" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "How is engagement against reach worked out?" }));
    const tooltip = screen.getByRole("tooltip");
    const paragraphs = tooltip.querySelectorAll(":scope > p");
    expect(paragraphs).toHaveLength(3);
    const [heading, body, comparison] = paragraphs;
    expect(heading.textContent).toBe("Engagement against reach");
    expect(body.textContent).toBe(
      "How many of the people who saw this post engaged with it. Both figures are counts Instagram published, not estimates — which is why no figure in this column carries an ≈. Where a carousel's reach is taken from its first slide, the cell says so.",
    );
    expect(comparison.textContent).toBe(
      "Not comparable with Eng. / followers: that column divides by the creator's follower count, not by this post's reach.",
    );
  });

  it("(§4.6, literal) T2 renders DESIGN-3B's exact hardcoded copy, independent of constants.ts", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementFollowers" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "How is engagement against followers worked out?" }));
    const tooltip = screen.getByRole("tooltip");
    const paragraphs = tooltip.querySelectorAll(":scope > p");
    expect(paragraphs).toHaveLength(3);
    const [heading, body, comparison] = paragraphs;
    expect(heading.textContent).toBe("Engagement against followers");
    expect(body.textContent).toBe(
      "How much this post got relative to the size of the creator's audience. The follower count comes from a cached profile record that can be up to a week old, which is why every figure in this column carries an ≈.",
    );
    expect(comparison.textContent).toBe(
      "Not comparable with Eng. / reach: that column divides by the views or plays on the post itself, not by follower count.",
    );
  });

  /**
   * `ENGAGEMENT_HEADER_TOOLTIP_OPERANDS` — the operand stack — had ZERO independent coverage
   * before this ticket's review pass. Two reviewer mutations survived the full suite with the
   * tests above alone:
   *
   *   1. `"Views or plays on this post"` -> `"Views on this post"` — a direct §4.6 violation
   *      ("views or plays, never views alone") that the self-referential `toHaveTextContent`
   *      assertions above (which import the SAME string from `constants.ts` they render) can
   *      never catch, because a corrupted constant satisfies both the component and the
   *      assertion identically.
   *   2. Swapping `<p>{operands.numerator}</p>` and `<p>{operands.denominator}</p>` — the
   *      fraction inverts, teaching the calculation backwards — which none of the assertions
   *      above notice because they only check that both strings are present SOMEWHERE in the
   *      tooltip, never their order or role.
   *   3. A third `<p>` appended inside the operand `<div>` (e.g. `<p>(estimated)</p>` below
   *      the denominator, no digit) — the `data-testid` handles still resolve to the same two
   *      elements, so numerator/denominator equality and order both still pass. The
   *      `toHaveLength(2)` assertion on `numerator.parentElement`'s `<p>` children below pins
   *      the operand div's element set, catching an appended sibling the testid lookups alone
   *      cannot see.
   *
   * The four tests below hardcode every operand string literally (independent of
   * `constants.ts`, per the same rule as the `(§4.6, literal)` tests above) AND pin numerator
   * vs denominator by `data-testid`, not by document order alone, so a swap of the two `<p>`
   * elements' roles fails even if a future markup change reorders them in the DOM.
   */
  it("(§4.6, literal) engagementReach operand stack: numerator and denominator are pinned by role, independent of constants.ts", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementReach" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "How is engagement against reach worked out?" }));
    const tooltip = screen.getByRole("tooltip");
    const numerator = within(tooltip).getByTestId("operand-numerator");
    const denominator = within(tooltip).getByTestId("operand-denominator");

    expect(numerator.textContent).toBe("Likes + comments");
    expect(denominator.textContent).toBe("Views or plays on this post");
    expect(numerator.compareDocumentPosition(denominator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(numerator.parentElement?.querySelectorAll("p")).toHaveLength(2);
  });

  it("(§4.6, literal) engagementFollowers operand stack: numerator and denominator are pinned by role, independent of constants.ts", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementFollowers" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "How is engagement against followers worked out?" }));
    const tooltip = screen.getByRole("tooltip");
    const numerator = within(tooltip).getByTestId("operand-numerator");
    const denominator = within(tooltip).getByTestId("operand-denominator");

    expect(numerator.textContent).toBe("Likes + comments");
    expect(denominator.textContent).toBe("The creator's follower count");
    expect(numerator.compareDocumentPosition(denominator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(numerator.parentElement?.querySelectorAll("p")).toHaveLength(2);
  });

  it("(§4.6) engagementReach's denominator is never engagementFollowers' denominator (guards a whole-column operand-set swap)", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementReach" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "How is engagement against reach worked out?" }));
    const denominator = within(screen.getByRole("tooltip")).getByTestId("operand-denominator");
    expect(denominator.textContent).toBe("Views or plays on this post");
    expect(denominator.textContent).not.toBe("The creator's follower count");
  });

  it("(§4.6) engagementFollowers' denominator is never engagementReach's denominator (guards a whole-column operand-set swap)", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementFollowers" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "How is engagement against followers worked out?" }));
    const denominator = within(screen.getByRole("tooltip")).getByTestId("operand-denominator");
    expect(denominator.textContent).toBe("The creator's follower count");
    expect(denominator.textContent).not.toBe("Views or plays on this post");
  });
});
