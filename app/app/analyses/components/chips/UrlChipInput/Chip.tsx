"use client";

import { X } from "lucide-react";
import type { UrlChip } from "./types";
import { shortenUrl } from "./helpers";

/** Individual URL chip with error state and remove action. */
export function Chip({ chip, onRemove }: { chip: UrlChip; onRemove: () => void }) {
  const isError = !!chip.error;
  const displayUrl = shortenUrl(chip.url);

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        isError
          ? "bg-destructive/10 text-destructive"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      <span className="max-w-[200px] truncate">{displayUrl}</span>
      {isError && (
        <span className="ml-1 max-w-[120px] truncate opacity-70">
          ({chip.error})
        </span>
      )}
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
