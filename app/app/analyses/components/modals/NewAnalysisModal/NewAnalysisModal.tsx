"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { UrlChipInput } from "@/app/app/analyses/components/chips/UrlChipInput";
import type { UrlChip } from "@/app/app/analyses/components/chips/UrlChipInput";
import type { NewAnalysisModalProps } from "@/app/app/analyses/types";

/** Dialog for creating a new analysis with URL input and optional prompt. */
export function NewAnalysisModal({
  open,
  onOpenChange,
  onSubmit,
  isAnalyzing,
}: NewAnalysisModalProps) {
  const [chips, setChips] = useState<UrlChip[]>([]);
  const [prompt, setPrompt] = useState("");

  const handleAdd = (url: string) => {
    setChips((prev) => [...prev, { url }]);
  };

  const handleRemove = (index: number) => {
    setChips((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const urls = chips.map((c) => c.url);
    if (urls.length > 0) {
      onSubmit(urls, prompt.trim());
      setChips([]);
      setPrompt("");
    }
  };

  const canSubmit = chips.length > 0 && !isAnalyzing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Analysis</DialogTitle>
          <DialogDescription>
            Paste up to 10 URLs. Each URL will create its own analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">URLs</label>
            <UrlChipInput
              chips={chips}
              onAdd={handleAdd}
              onRemove={handleRemove}
              maxChips={10}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Prompt</label>
            <Textarea
              placeholder="e.g., Focus on hook strength and retention patterns..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAnalyzing}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
