import { useEffect, useState } from "react";

import { BREAKPOINT_PX } from "@/lib/hooks/useIsBelowBreakpoint/constants";
import type { BreakpointName } from "@/lib/hooks/useIsBelowBreakpoint/types";

/**
 * The single source of truth for "is the viewport currently below breakpoint
 * `name`". Backed by `window.matchMedia`, gated to `max-width:
 * ${BREAKPOINT_PX[name] - 0.02}px` — the 0.02px step closes the fractional
 * dead zone between `max-width: 1023px` and Tailwind's `min-width: 1024px`
 * (and the equivalent gap for every other breakpoint), so the hook and
 * Tailwind's `lg:`/`md:`/`sm:` variants never briefly disagree.
 *
 * Returns the literal `false` on the server and on the very first client
 * render, so SSR HTML is always identical to today's desktop HTML — no
 * hydration mismatch. The real value is applied after the effect flushes.
 * Deliberately `useState` + `useEffect`, not `useSyncExternalStore` with a
 * device-aware server snapshot, to keep that SSR contract literal rather
 * than inferred.
 */
export function useIsBelowBreakpoint(name: BreakpointName): boolean {
  const [isBelow, setIsBelow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const query = `(max-width: ${BREAKPOINT_PX[name] - 0.02}px)`;
    const mql = window.matchMedia(query);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsBelow(event.matches);
    };

    handleChange({ matches: mql.matches } as MediaQueryListEvent);

    mql.addEventListener("change", handleChange);

    return () => {
      mql.removeEventListener("change", handleChange);
    };
  }, [name]);

  return isBelow;
}
