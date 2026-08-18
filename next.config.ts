import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone/ (server.js + only the traced runtime deps),
  // deployable without `node_modules` installed. Does NOT copy public/ or
  // .next/static/ — the Dockerfile's runner stage copies both explicitly.
  // docs: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md
  output: "standalone",
};

export default nextConfig;
