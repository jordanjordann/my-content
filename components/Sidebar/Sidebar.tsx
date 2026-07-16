"use client";

import { BarChart3Icon, FilmIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SidebarProps } from "./types";

/** App sidebar with navigation links and a collapsible layout wrapper. */
export function Sidebar({ children }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-sidebar/95 backdrop-blur">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex size-9 items-center justify-center rounded-xl border bg-sidebar-accent text-accent">
            <FilmIcon className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              My
            </p>
            <h1 className="font-heading text-base font-semibold tracking-[-0.04em]">
              Content
            </h1>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-2 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Analysis
          </p>
          <Link
            href="/app/analyses"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent",
              pathname?.startsWith("/app/analyses") && "bg-sidebar-accent text-sidebar-foreground",
            )}
          >
            <BarChart3Icon className="size-4 text-accent" aria-hidden="true" />
            Analyses
          </Link>
        </nav>
      </aside>
      <main className="pl-64 min-h-dvh">{children}</main>
    </>
  );
}
