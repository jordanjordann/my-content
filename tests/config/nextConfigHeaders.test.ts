import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";

/**
 * Locks in the site-wide security headers added for issue #283 (audit
 * F-12). Asserts on the actual header VALUES (not just presence) so a
 * future edit that quietly weakens a directive — e.g. dropping
 * `frame-ancestors 'none'`, shortening the HSTS `max-age`, or widening
 * `img-src` — fails here instead of shipping silently.
 */

type HeaderRule = {
  source: string;
  headers: { key: string; value: string }[];
};

async function getHeaderRules(): Promise<HeaderRule[]> {
  if (typeof nextConfig.headers !== "function") {
    throw new Error("expected next.config.ts to export a headers() function");
  }
  return (await nextConfig.headers()) as HeaderRule[];
}

function getHeaderValue(rule: HeaderRule, key: string): string | undefined {
  return rule.headers.find((header) => header.key === key)?.value;
}

describe("next.config.ts security headers (issue #283)", () => {
  it("disables the x-powered-by header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("applies the site-wide header rule to every path except the image proxy", async () => {
    const rules = await getHeaderRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/((?!api/image-proxy).*)");
  });

  it("sets a Content-Security-Policy with frame-ancestors 'none' and no unvetted directive gaps", async () => {
    const [rule] = await getHeaderRules();
    const csp = getHeaderValue(rule, "Content-Security-Policy");
    expect(csp).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; " +
        "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
    );
  });

  it("sets X-Content-Type-Options to exactly nosniff", async () => {
    const [rule] = await getHeaderRules();
    expect(getHeaderValue(rule, "X-Content-Type-Options")).toBe("nosniff");
  });

  it("sets Strict-Transport-Security with a two-year max-age and includeSubDomains", async () => {
    const [rule] = await getHeaderRules();
    expect(getHeaderValue(rule, "Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains",
    );
  });

  it("sets Referrer-Policy to strict-origin-when-cross-origin", async () => {
    const [rule] = await getHeaderRules();
    expect(getHeaderValue(rule, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("excludes the image-proxy route from the site-wide header rule", async () => {
    const [rule] = await getHeaderRules();
    const sourceRegex = new RegExp(`^${rule.source.replace(/\//g, "\\/")}$`);
    expect(sourceRegex.test("/api/image-proxy")).toBe(false);
    expect(sourceRegex.test("/auth/pin")).toBe(true);
    expect(sourceRegex.test("/")).toBe(true);
  });
});
