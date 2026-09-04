import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisTableColumnHeaders } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/headers/AnalysisTableColumnHeaders";
import { AnalysisTableRow } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/rows/AnalysisTableRow";
import { ANALYSES_TABLE_COLUMNS } from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";

/**
 * Ticket #335 (TDD §6.2, C-3) — the `content` column is the only sticky-left column below
 * `lg`, identified by `column.id === "content"` (never array index — the visible column list
 * is caller-filtered, ticket #149). Assertions here render the real production DOM
 * (`@testing-library/react`, no source-text greps) and use literal `toBe`/`toEqual` on full
 * class strings — jsdom cannot prove media-query behaviour, but it CAN prove the exact classes
 * shipped, including the `lg:` reset tokens a desktop-regressing mutation would drop.
 */

const EXPECTED_HEADER_CONTENT_CLASS =
  "border-b px-3 py-2 align-bottom text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sticky left-0 z-30 bg-card shadow-[2px_0_4px_-2px_rgba(0,0,0,0.5)] lg:static lg:z-auto lg:bg-transparent lg:shadow-none lg:w-[300px]! lg:min-w-[300px]!";

const EXPECTED_BODY_CONTENT_CLASS =
  "p-3 align-top sticky left-0 z-20 bg-card shadow-[2px_0_4px_-2px_rgba(0,0,0,0.5)] lg:static lg:z-auto lg:bg-transparent lg:shadow-none";

function buildRow(): AnalysisListItemIndexed {
  return {
    id: "row-1",
    prompt: null,
    status: "completed",
    url: "https://instagram.com/reel/x",
    platform: "instagram",
    mediaType: "reel",
    username: "creator1",
    overallScore: 4,
    scorecard: null,
    schemaVersion: 3,
    thumbnailUrl: null,
    viewCount: 1000,
    playCount: null,
    likeCount: 100,
    likeAndViewCountsDisabled: null,
    postDate: "2026-07-12T00:00:00.000Z",
    durationSec: 30,
    caption: "caption",
    title: "A Sticky Column Test Title",
    createdAt: "2026-07-12T00:00:00.000Z",
    performance: null,
    style: null,
    searchText: "a sticky column test title",
    viewCountState: { kind: "count", value: 1000 },
    likeCountState: { kind: "count", value: 100 },
    tableDerived: null,
  };
}

describe("Sticky content column (ticket #335)", () => {
  it("puts the exact sticky + lg-reset class string on the header content cell, by id, literally", () => {
    render(
      <table>
        <AnalysisTableColumnHeaders columns={ANALYSES_TABLE_COLUMNS} />
      </table>,
    );

    const headerContentCell = document.querySelector('thead th[data-column-id="content"]');
    expect(headerContentCell).not.toBeNull();
    expect(headerContentCell?.getAttribute("class")).toBe(EXPECTED_HEADER_CONTENT_CLASS);
  });

  it("puts the exact sticky + lg-reset class string on the body content cell, by id, literally", () => {
    render(
      <table>
        <tbody>
          <AnalysisTableRow row={buildRow()} columns={ANALYSES_TABLE_COLUMNS} density="comfortable" onOpen={() => {}} />
        </tbody>
      </table>,
    );

    const bodyContentCell = document.querySelector('tbody td[data-column-id="content"]');
    expect(bodyContentCell).not.toBeNull();
    expect(bodyContentCell?.getAttribute("class")).toBe(EXPECTED_BODY_CONTENT_CLASS);
  });

  it("applies the sticky-left treatment to NO cell other than content (header + body)", () => {
    const { container } = render(
      <table>
        <AnalysisTableColumnHeaders columns={ANALYSES_TABLE_COLUMNS} />
        <tbody>
          <AnalysisTableRow row={buildRow()} columns={ANALYSES_TABLE_COLUMNS} density="comfortable" onOpen={() => {}} />
        </tbody>
      </table>,
    );

    const stickyCells = Array.from(container.querySelectorAll("[class*='sticky left-0']"));
    expect(stickyCells.map((el) => el.getAttribute("data-column-id"))).toEqual(["content", "content"]);
  });

  it("identifies the sticky column by id, not array index, when the caller passes a filtered column list", () => {
    // Ticket #149 — `columns` is caller-filtered; `content` is NOT at index 0 here. An
    // index-based implementation would wrongly sticky `creator` (now index 0) instead.
    const filteredColumns = ANALYSES_TABLE_COLUMNS.filter((c) => c.id !== "posted");
    const reordered = [...filteredColumns.filter((c) => c.id === "creator"), ...filteredColumns.filter((c) => c.id !== "creator")];

    const { container } = render(
      <table>
        <AnalysisTableColumnHeaders columns={reordered} />
        <tbody>
          <AnalysisTableRow row={buildRow()} columns={reordered} density="comfortable" onOpen={() => {}} />
        </tbody>
      </table>,
    );

    expect(reordered[0]?.id).toBe("creator");
    const stickyCells = Array.from(container.querySelectorAll("[class*='sticky left-0']"));
    expect(stickyCells.map((el) => el.getAttribute("data-column-id"))).toEqual(["content", "content"]);
  });

  it("stacking contract: header-content z-30 > body-content z-20 > thead z-10, as coupled literals", () => {
    const { container } = render(
      <>
        <table>
          <AnalysisTableColumnHeaders columns={ANALYSES_TABLE_COLUMNS} />
          <tbody>
            <AnalysisTableRow row={buildRow()} columns={ANALYSES_TABLE_COLUMNS} density="comfortable" onOpen={() => {}} />
          </tbody>
        </table>
      </>,
    );

    const thead = container.querySelector("thead");
    const headerContentCell = container.querySelector('thead th[data-column-id="content"]');
    const bodyContentCell = container.querySelector('tbody td[data-column-id="content"]');

    const zClass = (el: Element | null, prefix: "z-30" | "z-20" | "z-10") =>
      el?.getAttribute("class")?.split(" ").includes(prefix) ? prefix : null;

    expect([
      zClass(headerContentCell, "z-30"),
      zClass(bodyContentCell, "z-20"),
      zClass(thead, "z-10"),
    ]).toEqual(["z-30", "z-20", "z-10"]);
  });

  it("content column width below lg is the literal 200px inline style, not the 300px column width", () => {
    render(
      <table>
        <AnalysisTableColumnHeaders columns={ANALYSES_TABLE_COLUMNS} />
      </table>,
    );

    const headerContentCell = document.querySelector('thead th[data-column-id="content"]') as HTMLTableCellElement;
    expect(headerContentCell.style.minWidth).toBe("200px");
    expect(headerContentCell.style.width).toBe("200px");
  });

  it("nine columns render in the exact locked order with their labels (desktop no-regression guard)", () => {
    render(
      <table>
        <AnalysisTableColumnHeaders columns={ANALYSES_TABLE_COLUMNS} />
      </table>,
    );

    // DOM order follows the two-row `<thead>` structure, not `ANALYSES_TABLE_COLUMNS`'
    // source order: the two `group: "scores"` columns (`contentScore`, `performance`) are
    // deferred to the second `<tr>` behind their shared colspan group header.
    const ths = Array.from(document.querySelectorAll('th[scope="col"]'));
    expect(ths.map((th) => [th.getAttribute("data-column-id"), th.textContent])).toEqual([
      ["content", "Content"],
      ["creator", "Creator"],
      ["posted", "Posted"],
      ["counts", "Counts"],
      ["multiplier", "vs their usual"],
      ["engagementReach", "Eng. / reach"],
      ["engagementFollowers", "Eng. / followers"],
      ["contentScore", "Content"],
      ["performance", "Performance"],
    ]);
  });
});
