export interface UrlChip {
  url: string;
  error?: string;
}

export interface UrlChipInputProps {
  chips: UrlChip[];
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
  onDismissError?: (index: number) => void;
  maxChips?: number;
  disabled?: boolean;
}
