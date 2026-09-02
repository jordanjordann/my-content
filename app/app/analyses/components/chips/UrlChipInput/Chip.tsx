"use client";

import { X } from "lucide-react";
import type { UrlChip } from "./types";
import { shortenUrl } from "./helpers";

/** Individual URL chip with a remove action. */
export function Chip({ chip, onRemove }: { chip: UrlChip; onRemove: () => void }) {
  const displayUrl = shortenUrl(chip.url);

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors">
      <span className="max-w-[200px] truncate">{displayUrl}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
