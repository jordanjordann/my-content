import type { RefObject } from "react";

export type SidebarProps = {
  children: React.ReactNode;
};

export type SidebarRailToggleProps = {
  isExpanded: boolean;
  toggleRef: RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
};

export type SidebarScrimProps = {
  onDismiss: () => void;
};

export type SidebarNavLinkProps = {
  href: string;
  label: string;
  icon: React.ComponentType<{
    className?: string;
    fill?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;
  isActive: boolean;
};
