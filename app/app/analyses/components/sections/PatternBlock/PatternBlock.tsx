"use client";

import type { PatternBlockProps } from "./types";

/** Reusable block for rendering a named list of pattern items with optional danger variant. */
export function PatternBlock({ title, items, variant }: PatternBlockProps) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border p-4">
      <h3
        className={`mb-2 text-sm font-semibold ${
          variant === "danger" ? "text-red-500" : ""
        }`}
      >
        {title}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
