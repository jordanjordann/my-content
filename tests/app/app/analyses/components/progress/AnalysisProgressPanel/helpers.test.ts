import { describe, expect, it } from "vitest";

import { formatFailedUrl } from "@/app/app/analyses/components/progress/AnalysisProgressPanel/helpers";

describe("formatFailedUrl", () => {
  it("returns host + pathname for a valid URL", () => {
    expect(formatFailedUrl("https://www.instagram.com/reel/abc123")).toBe(
      "www.instagram.com/reel/abc123",
    );
  });

  it("truncates to 60 chars", () => {
    const longPath = "a".repeat(80);
    const result = formatFailedUrl(`https://example.com/${longPath}`);
    expect(result.length).toBe(63); // 60 chars + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("returns the raw string unchanged if `new URL()` throws, rather than throwing", () => {
    expect(formatFailedUrl("not a url")).toBe("not a url");
  });
});
