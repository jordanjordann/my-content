import type { NextConfig } from "next";

// Site-wide CSP (issue #283 / audit F-12).
//
// FLAGGED FOR OWNER REVIEW: `script-src` includes `'unsafe-inline'`. Verified
// against a production build (`node .next/standalone/.../server.js`) of
// every page: Next.js 16's RSC streaming payload injects
// `<script>self.__next_f.push(...)</script>` tags with no `src` and no
// `nonce` on *every* response, including /auth/pin. Without
// `'unsafe-inline'` (or a nonce), the browser blocks these and hydration
// never runs — the app renders a static, non-interactive shell. The
// documented nonce-based alternative
// (docs: node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md)
// requires opting every page into dynamic rendering via proxy.ts, which is
// a materially larger change than this config-level, auth-untouched
// ticket — do not add it here without an explicit decision from the ticket
// owner. `style-src` needs `'unsafe-inline'` for the same reason: next/font
// and Tailwind's runtime both emit inline <style> tags.
const isDev = process.env.NODE_ENV === "development";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Inert on `localhost` (browsers exempt it), but would upgrade every
  // subresource to HTTPS and break the page if the dev server is reached
  // over plain HTTP on a LAN IP (e.g. testing on a real phone). Only ship
  // it in production, same as `'unsafe-eval'` above being dev-only.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  // Produces .next/standalone/ (server.js + only the traced runtime deps),
  // deployable without `node_modules` installed. Does NOT copy public/ or
  // .next/static/ — the Dockerfile's runner stage copies both explicitly.
  // docs: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md
  output: "standalone",
  // Stop disclosing the framework in every response header (audit F-12, P2).
  // docs: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/poweredByHeader.md
  poweredByHeader: false,
  async headers() {
    // docs: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md
    return [
      {
        // Everything except /api/image-proxy: that route already sets its
        // own tighter `Content-Security-Policy: default-src 'none'` and
        // `X-Content-Type-Options: nosniff` on binary image bytes (see
        // app/api/image-proxy/route.ts). Per the "Header Overriding
        // Behavior" section of the headers() doc, a later-matching config
        // entry with the same key wins — so a site-wide CSP applied here
        // would silently replace and loosen that route's stricter policy.
        source: "/((?!api/image-proxy).*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
