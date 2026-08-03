import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * PR #111 review B1: `tests/server/analysis/prompts/user.engagementLabel.test 2.ts`
 * was a macOS "keep both files" duplicate artifact that got swept in during
 * crash recovery. It was byte-identical to its non-" 2" twin, and — because
 * `vitest.config.ts`'s `include: ["tests/**\/*.test.ts"]` glob does not match
 * a filename ending in `.test 2.ts` — it was NEVER collected by the test
 * runner. `tsconfig.json`'s `**\/*.ts` include DID typecheck it, so the suite
 * was green while carrying 95 lines of permanently dead, driftable test code.
 *
 * This test is the guard: it fails CI if any TRACKED file (never `.next/` —
 * gitignored build-cache duplicates like `cache-life.d 2.ts` are expected and
 * must NOT trip this) matches the `<name> <n>.<ext>` duplicate-file pattern
 * that macOS/Finder/some sync tools produce (e.g. `foo 2.ts`, `bar 3.json`).
 *
 * Kept cheap and fully offline: a single `git ls-files` invocation, no
 * network, no filesystem walk beyond what git already indexes.
 */
describe("repo hygiene — no tracked duplicate-file artifacts", () => {
  const DUPLICATE_ARTIFACT_PATTERN = / \d+\.[^./\\]+$/;

  function listTrackedFiles(): string[] {
    const output = execFileSync("git", ["ls-files"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    return output.split("\n").filter((line) => line.length > 0);
  }

  it("has zero tracked files matching a ` <n>.<ext>` duplicate-file suffix", () => {
    const offenders = listTrackedFiles().filter((file) => DUPLICATE_ARTIFACT_PATTERN.test(file));

    expect(offenders).toEqual([]);
  });

  it("the guard pattern actually detects the exact B1 artifact filename (self-check)", () => {
    // Demonstrates the guard is not vacuous: the literal filename removed in
    // PR #111 B1 DOES match the pattern, so had it still been tracked this
    // test file's sibling assertion above would have failed.
    expect(
      DUPLICATE_ARTIFACT_PATTERN.test(
        "tests/server/analysis/prompts/user.engagementLabel.test 2.ts",
      ),
    ).toBe(true);
    // A normal, non-artifact filename must NOT match.
    expect(
      DUPLICATE_ARTIFACT_PATTERN.test("tests/server/analysis/prompts/user.engagementLabel.test.ts"),
    ).toBe(false);
  });
});
