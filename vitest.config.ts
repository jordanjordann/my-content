import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Test harness (ticket #64, split into two projects by ticket #123).
 *
 * `test.projects` (vitest 4's replacement for the deprecated
 * `defineWorkspace`/`vitest.workspace.ts` file — see
 * https://vitest.dev/guide/projects) runs more than one environment out of
 * this single `vitest.config.ts` in one `vitest run` invocation, instead of
 * maintaining a second sibling config file. Each entry below is an inline
 * project config that extends this file's shared `resolve.alias` (via
 * `extends: true`) and then overrides only what differs.
 *
 * - `node` project: the original ticket #64 suite. Nothing under
 *   `tests/**\/*.test.ts` touches the DOM — kept exactly as before, same
 *   glob, same environment, same setup file.
 * - `jsdom` project (ticket #123): a SEPARATE environment for tests that
 *   render real React components/hooks (`@testing-library/react` +
 *   `@testing-library/jest-dom`), scoped to its own glob
 *   (`tests/**\/*.dom.test.tsx`) so it can never silently swallow a plain
 *   `.test.ts` file. This is deliberately NOT a global `environment: "jsdom"`
 *   flip — jsdom is slower and unnecessary for the ~240 existing node tests,
 *   and keeping them on `node` means they're unaffected by anything
 *   jsdom-specific (timers, `fetch` polyfills, etc.).
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
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          globals: false,
          // Installs a `fetch` stub that throws on any unstubbed call, naming
          // the attempted URL. Makes "the suite is offline by construction"
          // (RUNBOOK §7) self-enforcing instead of a convention only some
          // test files happen to follow. See tests/setup/blockLiveFetch.ts.
          setupFiles: ["./tests/setup/blockLiveFetch.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["tests/**/*.dom.test.tsx"],
          globals: false,
          // Same offline-by-construction guarantee applies here — jsdom
          // tests are just as capable of an accidental live `fetch` (e.g.
          // via a query hook's `queryFn`) as node ones.
          setupFiles: ["./tests/setup/blockLiveFetch.ts", "./tests/setup/domMatchers.ts"],
        },
      },
    ],
  },
});
