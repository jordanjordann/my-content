"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  XIcon,
  LoaderCircleIcon,
  CalendarIcon,
  EyeIcon,
  FilmIcon,
  ImageIcon,
  LayersIcon,
  Trash2Icon,
  RefreshCwIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  useAnalysisQuery,
  useDeleteAnalysisMutation,
} from "@/lib/api/analyses";
import { ANALYSIS_KEYS } from "@/lib/api/analyses/constants";
import { AnalysisScorecardSection } from "@/app/app/analyses/components/sections/AnalysisScorecardSection";
import { AnalysisPatternsSection } from "@/app/app/analyses/components/sections/AnalysisPatternsSection";
import { AnalysisSuggestionsSection } from "@/app/app/analyses/components/sections/AnalysisSuggestionsSection";
import type { AnalysisDetailModalProps } from "./types";
import { formatViews, formatDate } from "./helpers";

export function AnalysisDetailModal({ id, onClose }: AnalysisDetailModalProps) {
  const queryClient = useQueryClient();
  const { data, isFetching, error } = useAnalysisQuery(id);
  const { mutate: removeAnalysis, isPending: isDeleting } =
    useDeleteAnalysisMutation();
  const [isClosing, setIsClosing] = useState(false);
  const [isReAnalyzing, setIsReAnalyzing] = useState(false);
  const [reAnalyzeError, setReAnalyzeError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 150);
  }, [onClose]);

  const handleReAnalyze = useCallback(async () => {
    if (!data?.url) {
      setReAnalyzeError("No URL available to re-analyze.");
      return;
    }

    setIsReAnalyzing(true);
    setReAnalyzeError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [data.url], prompt: data.prompt ?? "", existingId: id }),
      });
      const result = (await response.json()) as {
        analysisIds?: string[];
        error?: string;
        analysesCreated?: number;
      };

      if (!response.ok || !result.analysisIds) {
        setReAnalyzeError(result.error ?? "Unable to re-analyze.");
        return;
      }

      if (result.analysesCreated === 0) {
        setReAnalyzeError("The URL may be invalid or unavailable.");
      } else if (result.error) {
        setReAnalyzeError(result.error);
      } else {
        toast.success("Re-analysis complete!");
        void queryClient.invalidateQueries({ queryKey: ANALYSIS_KEYS.detail(id) });
        void queryClient.invalidateQueries({ queryKey: ANALYSIS_KEYS.lists() });
      }
    } catch {
      setReAnalyzeError("Unable to connect to the analyze endpoint.");
    } finally {
      setIsReAnalyzing(false);
    }
  }, [data, id, queryClient]);

  const handleDelete = useCallback(() => {
    removeAnalysis(id, {
      onSuccess: () => {
        toast.success("Analysis deleted.");
        handleClose();
      },
      onError: () => {
        toast.error("Failed to delete analysis.");
      },
    });
  }, [id, removeAnalysis, handleClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [handleClose]);

  const results = data?.results ?? null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-150 ${isClosing ? "opacity-0" : "opacity-100"}`}
      onClick={handleClose}
    >
      <div
        className={`relative flex h-[90vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl transition-transform duration-150 ${isClosing ? "scale-95" : "scale-100"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="line-clamp-1 font-semibold text-lg">
            {data?.title || data?.prompt || "Analysis Details"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg p-2 transition-colors hover:bg-secondary"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {isFetching ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <LoaderCircleIcon
                className="size-6 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          ) : error ? (
            <div className="flex flex-1 items-start gap-3 rounded-xl p-4 text-sm text-destructive">
              <AlertTriangleIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {error.message}
            </div>
          ) : results ? (
            <>
              {/* Thumbnail sidebar */}
              <div className="w-full shrink-0 border-b lg:w-72 lg:border-b-0 lg:self-stretch p-6 pb-0 lg:pb-6">
                {data ? (
                  <>
                    <div className="relative aspect-[9/16] overflow-hidden rounded-xl border bg-secondary">
                      {data.thumbnailUrl ? (
                        <>
                          <a
                            href={data.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${data.platform} content by ${data.username} in a new tab`}
                            className="block h-full w-full"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={data.thumbnailUrl}
                              alt={data.username}
                              className="h-full w-full object-cover"
                            />
                          </a>
                          <div className="absolute left-2 top-2 rounded-md bg-black/60 p-1.5 text-white/80">
                            {data.mediaType === "reel" ? (
                              <FilmIcon className="size-3.5" />
                            ) : data.mediaType === "carousel" ? (
                              <LayersIcon className="size-3.5" />
                            ) : (
                              <ImageIcon className="size-3.5" />
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <FilmIcon className="size-8" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                      {data.viewCount != null && (
                        <div className="flex items-center gap-2">
                          <EyeIcon
                            className="size-4 shrink-0 text-accent"
                            aria-hidden="true"
                          />
                          <span>{formatViews(data.viewCount)} views</span>
                        </div>
                      )}
                      {data.postDate && (
                        <div className="flex items-center gap-2">
                          <CalendarIcon
                            className="size-4 shrink-0 text-accent"
                            aria-hidden="true"
                          />
                          <span>{formatDate(data.postDate)}</span>
                        </div>
                      )}
                      {data.caption && (
                        <p className="text-xs leading-relaxed">
                          {data.caption}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    Content unavailable
                  </div>
                )}
              </div>

              {/* Vertical divider */}
              <div className="hidden w-px shrink-0 self-stretch bg-border lg:block" />

              {/* Content panel */}
              <div className="min-w-0 flex-1 overflow-y-auto p-6">
                <AnalysisScorecardSection results={results} />
                <div className="mt-6">
                  <AnalysisPatternsSection results={results} />
                </div>
                <div className="mt-6">
                  <AnalysisSuggestionsSection results={results} />
                </div>
              </div>
            </>
          ) : data?.results === null ? (
            <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
              No analysis results available.
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReAnalyze}
              disabled={isReAnalyzing}
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              {isReAnalyzing ? (
                <LoaderCircleIcon
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <RefreshCwIcon className="size-4" aria-hidden="true" />
              )}
              {isReAnalyzing ? "Re-analyzing..." : "Re-analyze"}
            </button>
            {reAnalyzeError && (
              <span className="text-xs text-destructive">{reAnalyzeError}</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            {isDeleting ? (
              <LoaderCircleIcon
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Trash2Icon className="size-4" aria-hidden="true" />
            )}
            {isDeleting ? "Deleting..." : "Delete Analysis"}
          </button>
        </div>
      </div>
    </div>
  );
}
