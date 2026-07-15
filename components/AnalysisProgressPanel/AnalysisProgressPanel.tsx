"use client";

import { ChevronDown, ChevronUp, X, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";

import { Progress } from "@/components/ui/progress";
import type { AnalysisProgressPanelProps } from "./types";

export function AnalysisProgressPanel({
  progress,
  onDismiss,
  onRetry,
}: AnalysisProgressPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!progress) return null;

  const isError = progress.step === "error";
  const isComplete = progress.step === "complete";
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-4xl px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center gap-3">
            {isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : isError ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{progress.message}</p>
              {!isComplete && !isError && (
                <Progress value={pct} className="mt-1 h-1" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isError && onRetry && (
              <button
                onClick={onRetry}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            >
              {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              onClick={onDismiss}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {!collapsed && (
          <div className="mt-2 text-xs text-muted-foreground">
            {progress.current}/{progress.total} items processed
          </div>
        )}
      </div>
    </div>
  );
}
