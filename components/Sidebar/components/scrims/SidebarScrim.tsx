import type { SidebarScrimProps } from "@/components/Sidebar/types";

/**
 * Scrim shown behind the EXPANDED overlay rail below `lg`. Not a focus
 * target and not the accessible close control — `Esc` and the toggle carry
 * that role; this only offers a tap-to-dismiss affordance and is hidden
 * from assistive tech.
 */
export function SidebarScrim({ onDismiss }: SidebarScrimProps) {
  return (
    <div
      className="fixed inset-0 z-30 bg-black/60 lg:hidden transition-opacity duration-200 motion-reduce:transition-none"
      aria-hidden="true"
      onClick={onDismiss}
    />
  );
}
