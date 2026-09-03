/**
 * Shared `window.matchMedia` test stub (ticket #334 / TDD #284 §4, §9 C-9).
 *
 * jsdom ships a stub `matchMedia` that never matches and never fires change
 * events, so breakpoint *behaviour* can't be exercised against it directly.
 * This helper installs a controllable fake in its place, for
 * `useIsBelowBreakpoint` (T1) and every downstream consumer (T2 `Sidebar`,
 * T4 `AnalysisCardList`) to reuse rather than re-implement.
 *
 * Deliberately NOT named `*.test.ts` / `*.dom.test.*` — it is a helper
 * imported by suites, not a suite itself, and must not match either of
 * `vitest.config.ts`'s project globs.
 */
import { vi } from "vitest";

interface MatchMediaStub {
  /** Every query string a consumer passed to `matchMedia`, in call order. */
  queries: string[];
  /** Flips the `matches` state for `query` and dispatches a real `change` event. */
  setMatches(query: string, matches: boolean): void;
  /** Number of `change` listeners currently registered for `query` (0 if none / unknown). */
  listenerCount(query: string): number;
  /** Restores the previous `window.matchMedia` (or removes the stub entirely). */
  restore(): void;
}

interface MediaQueryListEntry {
  matches: boolean;
  listeners: Set<(event: MediaQueryListEvent) => void>;
}

export function installMatchMediaStub(): MatchMediaStub {
  const originalMatchMedia = window.matchMedia;
  const queries: string[] = [];
  const entriesByQuery = new Map<string, MediaQueryListEntry>();

  const matchMediaMock = vi.fn((query: string): MediaQueryList => {
    queries.push(query);

    let entry = entriesByQuery.get(query);
    if (!entry) {
      entry = { matches: false, listeners: new Set() };
      entriesByQuery.set(query, entry);
    }

    const mql = {
      get matches() {
        return entry!.matches;
      },
      media: query,
      onchange: null,
      addEventListener: (
        type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        if (type === "change") {
          entry!.listeners.add(listener);
        }
      },
      removeEventListener: (
        type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        if (type === "change") {
          entry!.listeners.delete(listener);
        }
      },
      dispatchEvent: () => true,
      addListener: () => {
        throw new Error(
          "matchMediaStub: the deprecated `addListener` API was called; use `addEventListener` instead.",
        );
      },
      removeListener: () => {
        throw new Error(
          "matchMediaStub: the deprecated `removeListener` API was called; use `removeEventListener` instead.",
        );
      },
    } as unknown as MediaQueryList;

    return mql;
  });

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMediaMock,
  });

  return {
    queries,
    setMatches(query: string, matches: boolean) {
      const entry = entriesByQuery.get(query);
      if (!entry) {
        return;
      }

      entry.matches = matches;
      const event = { matches } as MediaQueryListEvent;
      entry.listeners.forEach((listener) => listener(event));
    },
    listenerCount(query: string) {
      return entriesByQuery.get(query)?.listeners.size ?? 0;
    },
    restore() {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    },
  };
}
