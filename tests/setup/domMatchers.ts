/**
 * jsdom-project-only setup (ticket #123). Registered via `vitest.config.ts`'s
 * `jsdom` project `setupFiles`, so it applies to every `*.dom.test.{ts,tsx}`
 * file without each one having to import it — mirrors how `blockLiveFetch.ts`
 * is wired for the `node` project.
 *
 * `@testing-library/jest-dom/vitest` auto-extends vitest's `expect` with the
 * DOM matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.) — no manual
 * `expect.extend(matchers)` call needed, unlike the plain `@testing-library/
 * jest-dom` entrypoint aimed at Jest.
 */
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * The `jsdom` project sets `globals: false` (deliberately — see
 * `vitest.config.ts`), but `@testing-library/react`'s auto-cleanup only
 * registers itself when `afterEach` is available as a GLOBAL, which requires
 * `globals: true`. Without this, cleanup() never runs: mounted component
 * trees, live React Query subscriptions, and timers leak across every jsdom
 * test file. Import `afterEach` explicitly from `vitest` here instead of
 * flipping `globals: true` project-wide, so the fix stays scoped to RTL's
 * cleanup and doesn't affect the `node` project or vitest's own globals
 * handling.
 */
afterEach(cleanup);
