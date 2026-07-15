import { useEffect } from "react";

import type { UrlChipInputProps } from "./types";
import { validateUrl, splitPastedUrls } from "./helpers";
import { Chip } from "./Chip";

/** Chip-style input for pasting or typing multiple URLs with validation. */
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
