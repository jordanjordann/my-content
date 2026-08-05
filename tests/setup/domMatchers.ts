/**
 * jsdom-project-only setup (ticket #123). Registered via `vitest.config.ts`'s
 * `jsdom` project `setupFiles`, so it applies to every `*.dom.test.tsx` file
 * without each one having to import it — mirrors how `blockLiveFetch.ts` is
 * wired for the `node` project.
 *
 * `@testing-library/jest-dom/vitest` auto-extends vitest's `expect` with the
 * DOM matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.) — no manual
 * `expect.extend(matchers)` call needed, unlike the plain `@testing-library/
 * jest-dom` entrypoint aimed at Jest.
 */
import "@testing-library/jest-dom/vitest";
