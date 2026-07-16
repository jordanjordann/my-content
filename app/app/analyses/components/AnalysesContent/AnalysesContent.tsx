"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAnalysesQuery, useAnalyzeContentMutation, useDeleteAnalysisMutation } from "@/lib/api/analyses";
import type { ProgressState } from "@/app/app/analyses/components/progress/AnalysisProgressPanel/types";
import { AnalysisDataTable } from "@/app/app/analyses/components/grids/AnalysisDataTable";
import { AnalysisFilterSection } from "@/app/app/analyses/components/sections/AnalysisFilterSection";
import { AnalysisEmptySection } from "@/app/app/analyses/components/sections/AnalysisEmptySection";
import { NewAnalysisModal } from "@/app/app/analyses/components/modals/NewAnalysisModal";
import { AnalysisProgressPanel } from "@/app/app/analyses/components/progress/AnalysisProgressPanel";
import { AnalysisDetailModal } from "@/app/app/analyses/components/modals/AnalysisDetailModal";
import type { FilterState } from "@/app/app/analyses/types";

function buildQueryString(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.account) params.set("account", state.account);
  if (state.platform) params.set("platform", state.platform);
  if (state.mediaTypes.length > 0) params.set("mediaType", state.mediaTypes.join(","));
  if (state.sort === "oldest") params.set("sort", "oldest");
  return params.toString();
}

/** Displays the analyses list with filters, coordinates creation and detail modals. */
export function AnalysesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailId = searchParams.get("id");

  const { data, isPending } = useAnalysesQuery();
  const { mutate: startAnalysis, isPending: isAnalyzing } = useAnalyzeContentMutation();
  const { mutate: removeAnalysis, isPending: isDeleting } = useDeleteAnalysisMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const [filterState, setFilterState] = useState<FilterState>(() => ({
    account: searchParams.get("account") || null,
    platform: searchParams.get("platform") || undefined,
    mediaTypes: searchParams.get("mediaType")?.split(",").filter(Boolean) ?? [],
    sort: searchParams.get("sort") === "oldest" ? "oldest" : "newest",
  }));

  const analyses = data?.analyses ?? [];
  const accounts = data?.accounts ?? [];

  const filteredAnalyses = useMemo(() => {
    let result = [...(data?.analyses ?? [])];
    if (filterState.account) result = result.filter((a) => a.username === filterState.account);
    if (filterState.platform) result = result.filter((a) => a.platform === filterState.platform);
    if (filterState.mediaTypes.length > 0) result = result.filter((a) => filterState.mediaTypes.includes(a.mediaType));
    if (filterState.sort === "oldest") result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return result;
  }, [data, filterState]);

  const hasActiveFilters =
    filterState.account !== null ||
    filterState.platform !== undefined ||
    filterState.mediaTypes.length > 0 ||
    filterState.sort !== "newest";

  function syncURL(state: FilterState) {
    const qs = buildQueryString(state);
    router.replace(`/app/analyses${qs ? `?${qs}` : ""}`);
  }

  const handleFiltersChange = (filters: FilterState) => {
    setFilterState(filters);
    syncURL(filters);
  };

  const handleClearAll = () => {
    const defaults: FilterState = { account: null, platform: undefined, mediaTypes: [], sort: "newest" };
    setFilterState(defaults);
    syncURL(defaults);
  };

  const handleAnalyze = (urls: string[], prompt: string) => {
    setModalOpen(false);
    setProgress({
      step: "classifying",
      current: 0,
      total: urls.length,
      message: "Starting analysis...",
    });

    startAnalysis(
      { urls, prompt },
      {
        onSuccess: (result) => {
          if (result.analysesCreated === 0) {
            setProgress({
              step: "error",
              current: 0,
              total: urls.length,
              message: "No analyses were created",
            });
            toast.error("Analysis failed", {
              description: `${result.failedUrls.length} URL${result.failedUrls.length !== 1 ? "s" : ""} failed`,
            });
            return;
          }

          setProgress({
            step: "complete",
            current: result.analysesCreated,
            total: urls.length,
            message: `Analysis complete — ${result.analysesCreated} analyses created`,
          });
          toast.success("Analysis complete", {
            description: `${result.analysesCreated} analyses created${result.failedUrls.length > 0 ? `, ${result.failedUrls.length} failed` : ""}`,
          });
        },
        onError: (error) => {
          setProgress((prev) =>
            prev
              ? { ...prev, step: "error", message: error.message || "Analysis failed" }
              : null,
          );
          toast.error("Analysis failed", {
            description: error.message || "Something went wrong.",
          });
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    removeAnalysis(id, {
      onSuccess: () => {
        toast.success("Analysis deleted");
      },
      onError: () => {
        toast.error("Failed to delete analysis");
      },
    });
  };

  return (
    <>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Analyses</h1>
          <Button onClick={() => setModalOpen(true)}>New Analysis</Button>
        </div>

        <AnalysisFilterSection
          accounts={accounts}
          filters={filterState}
          onFiltersChange={handleFiltersChange}
          hasActiveFilters={hasActiveFilters}
          onClearAll={handleClearAll}
        />

        {isPending ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : analyses.length === 0 ? (
          <AnalysisEmptySection context="no_data" onNewAnalysis={() => setModalOpen(true)} />
        ) : filteredAnalyses.length === 0 ? (
          <AnalysisEmptySection context="no_matches" onClearFilters={handleClearAll} />
        ) : (
          <AnalysisDataTable
            analyses={filteredAnalyses}
            onAnalysisClick={(id) => router.push(`/app/analyses?id=${id}`)}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}

        <NewAnalysisModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSubmit={handleAnalyze}
          isAnalyzing={isAnalyzing}
        />

        <AnalysisProgressPanel progress={progress} onDismiss={() => setProgress(null)} />
      </div>

      {detailId && (
        <AnalysisDetailModal id={detailId} onClose={() => router.push("/app/analyses")} />
      )}
    </>
  );
}
