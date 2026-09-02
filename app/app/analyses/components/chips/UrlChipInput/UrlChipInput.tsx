import { useEffect, useId, useState } from "react";

import type { UrlChipInputProps } from "./types";
import { validateUrl, partitionPastedUrls } from "./helpers";
import { INVALID_URL_MESSAGE, buildRejectedUrlsMessage } from "./constants";
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
  const [value, setValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const errorId = useId();

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setInputError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;

    const url = e.currentTarget.value.trim();
    if (!url) return;

    e.preventDefault();
    const error = validateUrl(url);
    if (error) {
      setInputError(error);
      return;
    }

    onAdd(url);
    setValue("");
    setInputError(null);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    const { accepted, rejected } = partitionPastedUrls(text);

    for (const url of accepted) {
      onAdd(url);
    }

    setValue(rejected.join(" "));

    if (rejected.length === 0) {
      setInputError(null);
    } else if (rejected.length === 1) {
      setInputError(INVALID_URL_MESSAGE);
    } else {
      setInputError(buildRejectedUrlsMessage(rejected.length));
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
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          aria-invalid={!!inputError}
          aria-describedby={errorId}
        />
      )}
      {isFull && (
        <p className="text-xs text-muted-foreground">
          Maximum {maxChips} URLs reached
        </p>
      )}
      <p id={errorId} role="status" aria-live="polite" className="min-h-[1rem] text-xs text-destructive">
        {inputError ?? ""}
      </p>
    </div>
  );
}
