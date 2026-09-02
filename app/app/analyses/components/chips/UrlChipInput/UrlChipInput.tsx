import { useId, useState } from "react";

import type { UrlChipInputProps } from "./types";
import { validateUrl, partitionPastedUrls } from "./helpers";
import { INVALID_URL_MESSAGE, buildRejectedUrlsMessage, buildCapMessage } from "./constants";
import { Chip } from "./Chip";

/** Chip-style input for pasting or typing multiple URLs with validation. */
export function UrlChipInput({
  chips,
  onAdd,
  onRemove,
  maxChips = 10,
  disabled,
}: UrlChipInputProps) {
  const [value, setValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const errorId = useId();

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

    // Ticket #322 — never let a single paste push the chip count past maxChips.
    // `remaining` is fixed at the capacity available *before* this paste, computed from
    // the current render's `chips` prop (correct for a single synchronous event).
    const remaining = Math.max(0, maxChips - chips.length);
    const toAdd = accepted.slice(0, remaining);
    const overCap = accepted.slice(remaining);

    for (const url of toAdd) {
      onAdd(url);
    }

    // Merge with whatever was already typed (but not yet submitted) rather than
    // overwrite it -- a paste should never silently destroy text the user typed
    // before pasting. Over-cap accepted URLs and rejected URLs are both put back so
    // nothing is silently dropped.
    setValue((prev) =>
      [prev.trim(), overCap.join(" "), rejected.join(" ")].filter(Boolean).join(" "),
    );

    if (overCap.length > 0) {
      // The cap is the harder stop -- it takes priority over the invalid-URL message
      // when a paste is both over-cap and mixed with invalid URLs.
      setInputError(buildCapMessage(remaining, maxChips));
    } else if (rejected.length === 0) {
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
