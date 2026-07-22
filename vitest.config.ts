import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Test harness (ticket #64). Node environment only — nothing under test here
 * touches the DOM. If a future ticket adds component tests, give them their
 * own `environmentMatchGlobs`/project entry rather than flipping the global
 * environment to jsdom.
 *
 * The `@/` alias must stay in lockstep with `tsconfig.json`'s
 * `compilerOptions.paths` (`"@/*": ["./*"]`, i.e. repo root), otherwise
 * modules resolve under `tsc --noEmit` but not under vitest.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    // Installs a `fetch` stub that throws on any unstubbed call, naming the
    // attempted URL. Makes "the suite is offline by construction" (RUNBOOK
    // §7) self-enforcing instead of a convention only some test files
    // happen to follow. See tests/setup/blockLiveFetch.ts.
    setupFiles: ["./tests/setup/blockLiveFetch.ts"],
  },
});
