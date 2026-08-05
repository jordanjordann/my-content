import { fileURLToPath } from "node:url";
import { defaultExclude, defineConfig } from "vitest/config";

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
 *   (`tests/**\/*.dom.test.{ts,tsx}`).
 *
 * NAMING CONVENTION — REQUIRED: any jsdom-flavored test file MUST be named
 * `*.dom.test.ts` or `*.dom.test.tsx` (not just `*.test.tsx`). The `node`
 * project's glob (`tests/**\/*.test.ts`) would otherwise also match a
 * `.dom.test.ts` file (it still ends in `.test.ts`), silently running a
 * DOM-dependent test with no DOM and no jest-dom matchers. The `node`
 * project's `exclude` below closes that gap explicitly rather than relying
 * on extension coincidence, so the two projects' globs are mutually
 * exclusive and jointly exhaustive over `tests/**\/*.test.ts` vs
 * `tests/**\/*.dom.test.*`. A plain `*.test.tsx` file (no `.dom.` segment)
 * matches NEITHER project and will silently not run at all — see RUNBOOK
 * §7.
 *
 * This is deliberately NOT a global `environment: "jsdom"` flip — jsdom is
 * slower and unnecessary for the ~240 existing node tests, and keeping them
 * on `node` means they're unaffected by anything jsdom-specific (timers,
 * `fetch` polyfills, etc.).
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
          // Excludes `.dom.test.*` files, which the include glob above would
          // otherwise also match (they still end in `.test.ts`) — see the
          // naming-convention note in the file-level comment above. Spreads
          // vitest's own `defaultExclude` (node_modules, .git) since setting
          // `exclude` here would otherwise replace it, not merge with it.
          exclude: [...defaultExclude, "tests/**/*.dom.test.*"],
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
          include: ["tests/**/*.dom.test.{ts,tsx}"],
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
