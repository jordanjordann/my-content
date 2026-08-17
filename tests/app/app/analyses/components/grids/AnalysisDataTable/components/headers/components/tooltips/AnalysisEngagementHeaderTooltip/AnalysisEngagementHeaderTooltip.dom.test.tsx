import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisEngagementHeaderTooltip } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/headers/components/tooltips/AnalysisEngagementHeaderTooltip";
import {
  ENGAGEMENT_HEADER_TOOLTIP_BODY,
  ENGAGEMENT_HEADER_TOOLTIP_COMPARISON,
  ENGAGEMENT_HEADER_TOOLTIP_HEADING,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/components/headers/components/tooltips/AnalysisEngagementHeaderTooltip/constants";

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
   */
  it("(§4.6, literal) T1 renders DESIGN-3B's exact hardcoded copy, independent of constants.ts", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementReach" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "How is engagement against reach worked out?" }));
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Engagement against reach");
    expect(tooltip).toHaveTextContent(
      "How many of the people who saw this post engaged with it. Both figures are counts Instagram published, not estimates — which is why no figure in this column carries an ≈. Where a carousel's reach is taken from its first slide, the cell says so.",
    );
    expect(tooltip).toHaveTextContent(
      "Not comparable with Eng. / followers: that column divides by the creator's follower count, not by this post's reach.",
    );
  });

  it("(§4.6, literal) T2 renders DESIGN-3B's exact hardcoded copy, independent of constants.ts", () => {
    render(<AnalysisEngagementHeaderTooltip columnId="engagementFollowers" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "How is engagement against followers worked out?" }));
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Engagement against followers");
    expect(tooltip).toHaveTextContent(
      "How much this post got relative to the size of the creator's audience. The follower count comes from a cached profile record that can be up to a week old, which is why every figure in this column carries an ≈.",
    );
    expect(tooltip).toHaveTextContent(
      "Not comparable with Eng. / reach: that column divides by the views or plays on the post itself, not by follower count.",
    );
  });
});
