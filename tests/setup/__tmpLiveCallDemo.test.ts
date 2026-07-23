import { describe, expect, it } from "vitest";

/**
 * TEMPORARY — demonstrates that CI fails red if a test attempts a real
 * outbound network call, proving the guardrail in tests/setup/blockLiveFetch.ts
 * actually works end-to-end in the CI environment (ticket #83 acceptance
 * criteria). This file is removed in a follow-up commit on the same PR.
 */
describe("TEMPORARY: live call demo (should make CI fail)", () => {
  it("attempts an unstubbed real fetch call", async () => {
    const response = await fetch("https://api.scrapecreators.com/v1/youtube/video?url=demo");
    expect(response.status).toBe(200);
  });
});
