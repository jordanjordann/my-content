export type AnalysisColumnsMenuColumn = {
  id: string;
  label: string;
  /** One of the four denominator-bearing columns (DESIGN-3C §6.3) — disabled + tooltipped. */
  locked: boolean;
  /**
   * Whether this column's checkbox actually responds to a click. Only `Style` is (Q3, OR-5).
   * The other five default columns render checked-and-disabled with NO tooltip (distinct from
   * `locked`, which is the four R-12.3.1 columns and carries the "Always shown" copy) — §2.2's
   * "nine, and only these nine" default set has no per-column hide affordance specified beyond
   * Style, and a shared `<th colspan="2">` group header (Content score + Performance) makes
   * independently hiding just one of that pair a structural change no design record specifies.
   */
  interactive: boolean;
};

export type AnalysisColumnsMenuProps = {
  /** Every column offered in the menu, display order — locked ones render disabled + tooltipped. */
  columns: AnalysisColumnsMenuColumn[];
  visibleColumnIds: ReadonlySet<string>;
  /** No-op for a locked column id — the menu itself also disables the control (belt and braces). */
  onToggle: (id: string) => void;
};
