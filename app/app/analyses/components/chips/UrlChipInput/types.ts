export interface UrlChip {
  url: string;
  error?: string;
}

/** Ticket #285 — result of partitioning pasted text by URL validity. */
export type PasteResult = { accepted: string[]; rejected: string[] };

export interface UrlChipInputProps {
  chips: UrlChip[];
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
  onDismissError?: (index: number) => void;
  maxChips?: number;
  disabled?: boolean;
}
