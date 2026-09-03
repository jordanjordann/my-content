import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SidebarNavLinkProps } from "@/components/Sidebar/types";

/**
 * A single rail nav link. Always renders icon + label; below `lg` the label
 * is visually hidden (`sr-only`) but stays in the accessibility tree, and an
 * explicit `aria-label` keeps the accessible name stable across both
 * states. Active state relies on three redundant, non-colour-only cues:
 * filled vs. outline icon, accent colour, and a 3px accent left bar.
 */
export function SidebarNavLink({ href, label, icon: Icon, isActive }: SidebarNavLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 items-center gap-3 rounded-lg border-l-[3px] border-transparent px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent",
        isActive && "border-accent bg-sidebar-accent text-sidebar-foreground",
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", isActive ? "text-accent" : "text-muted-foreground")}
        fill={isActive ? "currentColor" : "none"}
        aria-hidden="true"
      />
      <span className="sr-only lg:not-sr-only">{label}</span>
    </Link>
  );
}
