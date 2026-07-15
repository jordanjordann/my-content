"use client";

import { BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AnalysisEmptyProps } from "@/app/analyses/types";

export function AnalysisEmpty({ onNewAnalysis }: AnalysisEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <BarChart3 className="mb-4 h-16 w-16 text-muted-foreground/50" />
      <h2 className="mb-2 text-xl font-semibold">No analyses yet</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Paste some URLs and get AI-powered insights on your content.
      </p>
      <Button onClick={onNewAnalysis}>New Analysis</Button>
    </div>
  );
}
