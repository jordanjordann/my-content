import { describe, expect, it } from "vitest";

import { assertThemeMapping, assertThemeMappingInCss } from "@/tests/helpers/contrast";

/**
 * Ticket #221, B3 follow-up (PR #229 review, blocker 2) — `assertThemeMapping` guards every real
 * usage in this suite from `@theme inline` module-load time, but had no test of its own: if
 * someone deleted the two call lines at the bottom of `contrast.ts`, the loss was silent. These
 * tests pin the guard directly, against synthetic CSS, the way the guard pins `app/globals.css`.
 */
describe("assertThemeMappingInCss", () => {
  it("passes when the mapping resolves correctly", () => {
    const css = `
      @theme inline {
        --color-teal: var(--teal);
      }
    `;
    expect(() => assertThemeMappingInCss(css, "teal", "synthetic.css")).not.toThrow();
  });

  it("is tolerant of benign formatting — internal whitespace and no trailing semicolon", () => {
    const css = `
      @theme inline {
        --color-teal: var( --teal )
      }
    `;
    expect(() => assertThemeMappingInCss(css, "teal", "synthetic.css")).not.toThrow();
  });

  it("is tolerant of a line break inside the declaration", () => {
    const css = `
      @theme inline {
        --color-teal:
          var(--teal);
      }
    `;
    expect(() => assertThemeMappingInCss(css, "teal", "synthetic.css")).not.toThrow();
  });

  it("throws when the mapping is repointed at a different token", () => {
    const css = `
      @theme inline {
        --color-teal: var(--destructive);
      }
    `;
    expect(() => assertThemeMappingInCss(css, "teal", "synthetic.css")).toThrow(/repointed/);
  });

  it("throws when the mapping line is deleted entirely", () => {
    const css = `
      @theme inline {
        --color-accent: var(--accent);
      }
    `;
    expect(() => assertThemeMappingInCss(css, "teal", "synthetic.css")).toThrow(/declares no --color-teal/);
  });

  it("throws on a duplicate later declaration that repoints the token — the defect class this guard exists for", () => {
    const css = `
      @theme inline {
        --color-teal: var(--teal);
        --color-teal: var(--destructive);
      }
    `;
    expect(() => assertThemeMappingInCss(css, "teal", "synthetic.css")).toThrow(/repointed/);
  });

  it("passes on a duplicate later declaration that re-affirms the same, correct token", () => {
    const css = `
      @theme inline {
        --color-teal: var(--destructive);
        --color-teal: var(--teal);
      }
    `;
    expect(() => assertThemeMappingInCss(css, "teal", "synthetic.css")).not.toThrow();
  });

  it("finds a mapping declared in a SECOND @theme inline block, later in the file", () => {
    const css = `
      @theme inline {
        --color-accent: var(--accent);
      }
      .unrelated { color: red; }
      @theme inline {
        --color-teal: var(--teal);
      }
    `;
    expect(() => assertThemeMappingInCss(css, "teal", "synthetic.css")).not.toThrow();
  });

  it("a later @theme inline block's declaration overrides an earlier block's for the same token", () => {
    const css = `
      @theme inline {
        --color-teal: var(--teal);
      }
      @theme inline {
        --color-teal: var(--destructive);
      }
    `;
    expect(() => assertThemeMappingInCss(css, "teal", "synthetic.css")).toThrow(/repointed/);
  });

  it("is not fooled by a brace nested inside the @theme inline block", () => {
    const css = `
      @theme inline {
        /* a nested at-rule some future refactor could introduce */
        @supports (color: red) {
          --color-destructive: var(--destructive);
        }
        --color-teal: var(--teal);
      }
    `;
    expect(() => assertThemeMappingInCss(css, "teal", "synthetic.css")).not.toThrow();
  });

  it("throws when no @theme inline block exists at all", () => {
    const css = `.foo { color: red; }`;
    expect(() => assertThemeMappingInCss(css, "teal", "synthetic.css")).toThrow(/Could not find an "@theme inline/);
  });
});

describe("assertThemeMapping — reads the real app/globals.css", () => {
  it("does not throw for teal or accent against the real file (already proven by module load, asserted here directly too)", () => {
    expect(() => assertThemeMapping("teal")).not.toThrow();
    expect(() => assertThemeMapping("accent")).not.toThrow();
  });
});
