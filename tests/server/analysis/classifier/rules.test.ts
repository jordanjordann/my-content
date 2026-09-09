import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { classifyUrl, normaliseAnalysisUrl } from "@/lib/server/analysis/classifier/rules";

/**
 * Ticket #350 (3A-P3, normalisation half of #286) —
 * docs/planning/PLAN-3A-job-queue.md §3.1 P3, R5.
 *
 * `normaliseAnalysisUrl()` produces the dedupe key for `jobs.dedupe_key`
 * (S6). It is NOT a fetch target — see the load-bearing constraint at the
 * bottom of this file, verified by grep rather than assertion.
 *
 * Every case below is a named test that goes red when its own assertion is
 * deleted (#313/#315/#317 posture) — none of them merely prove collapsing
 * without also proving discrimination (E6's lesson).
 */

describe("normaliseAnalysisUrl", () => {
  it("collapses www, trailing slash, and utm_source query variants of the same Instagram reel to one key", () => {
    const variants = [
      "https://www.instagram.com/reel/ABC123",
      "https://instagram.com/reel/ABC123/",
      "https://www.instagram.com/reel/ABC123/?utm_source=ig_web_copy_link",
    ];

    const keys = variants.map((url) => normaliseAnalysisUrl(url));

    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe("https://instagram.com/reel/ABC123");
  });

  it("drops an igsh tracking param to the same key as the bare URL", () => {
    const bare = normaliseAnalysisUrl("https://www.instagram.com/reel/ABC123");
    const withIgsh = normaliseAnalysisUrl(
      "https://www.instagram.com/reel/ABC123/?igsh=xyz%3D%3D",
    );

    expect(withIgsh).toBe(bare);
  });

  it("normalises http scheme to https", () => {
    const httpKey = normaliseAnalysisUrl("http://www.instagram.com/reel/ABC123");
    const httpsKey = normaliseAnalysisUrl("https://www.instagram.com/reel/ABC123");

    expect(httpKey).toBe(httpsKey);
    expect(httpKey?.startsWith("https://")).toBe(true);
  });

  it("collapses www and a feature query param for the same YouTube short", () => {
    const withFeature = normaliseAnalysisUrl(
      "https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share",
    );
    const bare = normaliseAnalysisUrl("https://youtube.com/shorts/dQw4w9WgXcQ");

    expect(withFeature).toBe(bare);
    expect(bare).toBe("https://youtube.com/shorts/dQw4w9WgXcQ");
  });

  it("preserves media id case — different case ids must NOT collapse to the same key", () => {
    const upper = normaliseAnalysisUrl("https://www.instagram.com/reel/ABC123");
    const lower = normaliseAnalysisUrl("https://www.instagram.com/reel/abc123");

    expect(upper).not.toBeNull();
    expect(lower).not.toBeNull();
    expect(upper).not.toBe(lower);
  });

  it("treats a reel and a post with the same id as different keys", () => {
    const reel = normaliseAnalysisUrl("https://www.instagram.com/reel/ABC");
    const post = normaliseAnalysisUrl("https://www.instagram.com/p/ABC");

    expect(reel).not.toBeNull();
    expect(post).not.toBeNull();
    expect(reel).not.toBe(post);
  });

  it("returns null for a long-form YouTube watch URL (the classifier rejects it)", () => {
    expect(normaliseAnalysisUrl("https://youtube.com/watch?v=x")).toBeNull();
  });

  it("returns null for a youtu.be short-link URL (the classifier rejects it)", () => {
    expect(normaliseAnalysisUrl("https://youtu.be/x")).toBeNull();
  });

  it("returns null for a traversal-style shorts URL that resolves to /watch (end-anchoring must survive)", () => {
    expect(
      normaliseAnalysisUrl("https://www.youtube.com/shorts/x/../../watch?v=y"),
    ).toBeNull();
  });

  it("returns null for a garbage non-matching URL", () => {
    expect(normaliseAnalysisUrl("https://example.com/not-a-reel")).toBeNull();
  });

  it("agrees with classifyUrl on acceptance — every URL classifyUrl accepts, normaliseAnalysisUrl also accepts", () => {
    const url = "https://www.instagram.com/reel/ABC123/?utm_source=x";

    expect(classifyUrl(url)).not.toBeNull();
    expect(normaliseAnalysisUrl(url)).not.toBeNull();
  });

  it("agrees with classifyUrl on rejection — every URL classifyUrl rejects, normaliseAnalysisUrl also rejects", () => {
    const url = "https://youtube.com/watch?v=x";

    expect(classifyUrl(url)).toBeNull();
    expect(normaliseAnalysisUrl(url)).toBeNull();
  });
});

describe("normaliseAnalysisUrl — fetch-path isolation (load-bearing constraint)", () => {
  it("is not consumed as a fetch target by lib/server/analysis/fetcher or lib/server/analysis/pipeline", () => {
    let output = "";
    try {
      output = execSync(
        "grep -rn 'normaliseAnalysisUrl' lib/server/analysis/fetcher lib/server/analysis/pipeline",
        { encoding: "utf8" },
      );
    } catch (error) {
      // grep exits 1 with empty output when there are zero matches — that's
      // the expected, passing case. Any other failure re-throws.
      const execError = error as { status?: number; stdout?: string };
      if (execError.status !== 1) {
        throw error;
      }
      output = execError.stdout ?? "";
    }

    expect(output.trim()).toBe("");
  });
});
