import { X } from "lucide-react";
import { useEffect } from "react";

import type { UrlChipInputProps, UrlChip } from "./types";
import { validateUrl, splitPastedUrls } from "./helpers";

export function UrlChipInput({
  chips,
  onAdd,
  onRemove,
  onDismissError,
  maxChips = 10,
  disabled,
}: UrlChipInputProps) {
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    chips.forEach((chip, i) => {
      if (chip.error && onDismissError) {
        const timer = setTimeout(() => onDismissError(i), 3000);
        timers.push(timer);
      }
    });

    return () => timers.forEach(clearTimeout);
  }, [chips, onDismissError]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.currentTarget.value.trim()) {
      e.preventDefault();
      const url = e.currentTarget.value.trim();
      const error = validateUrl(url);
      if (!error) {
        onAdd(url);
      }
      e.currentTarget.value = "";
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    const urls = splitPastedUrls(text);

    for (const url of urls) {
      const error = validateUrl(url);
      if (!error) {
        onAdd(url);
      }
    }
  };

  const isFull = chips.length >= maxChips;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {chips.map((chip, i) => (
          <Chip key={i} chip={chip} onRemove={() => onRemove(i)} />
        ))}
      </div>
      {!isFull && (
        <input
          type="text"
          placeholder="Paste or type URLs..."
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
        />
      )}
      {isFull && (
        <p className="text-xs text-muted-foreground">
          Maximum {maxChips} URLs reached
        </p>
      )}
    </div>
  );
}

function Chip({ chip, onRemove }: { chip: UrlChip; onRemove: () => void }) {
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

function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url.length > 40 ? `${url.slice(0, 37)}...` : url;
  }
}
