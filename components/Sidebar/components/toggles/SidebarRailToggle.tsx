import { ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";
import { SIDEBAR_NAV_ID, SIDEBAR_TOGGLE_LABEL } from "@/components/Sidebar/constants";
import type { SidebarRailToggleProps } from "@/components/Sidebar/types";

/**
 * Rail toggle — always the first item in the rail below `lg`, controlling
 * COMPACT/EXPANDED. Rendered only when `isBelowLg` (and additionally
 * `lg:hidden` as CSS belt-and-braces so it is out of the tab order even in
 * the one frame before hydration settles).
 */
export function SidebarRailToggle({ isExpanded, toggleRef, onToggle }: SidebarRailToggleProps) {
  const label = isExpanded ? SIDEBAR_TOGGLE_LABEL.expanded : SIDEBAR_TOGGLE_LABEL.collapsed;

  return (
    <button
      ref={toggleRef}
      type="button"
      aria-controls={SIDEBAR_NAV_ID}
      aria-expanded={isExpanded}
      aria-label={label}
      onClick={onToggle}
      className="lg:hidden flex size-11 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
    >
      {isExpanded ? (
        <ChevronsLeftIcon className="size-4" aria-hidden="true" />
      ) : (
        <ChevronsRightIcon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
