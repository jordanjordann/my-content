"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAllAnalysesQuery, useAnalyzeContentMutation } from "@/lib/api/analyses";
import type { ProgressState } from "@/app/app/analyses/components/progress/AnalysisProgressPanel/types";
import { AnalysisDataTable } from "@/app/app/analyses/components/grids/AnalysisDataTable";
import { AnalysisFilterSection } from "@/app/app/analyses/components/sections/AnalysisFilterSection";
import { NewAnalysisModal } from "@/app/app/analyses/components/modals/NewAnalysisModal";
import { AnalysisProgressPanel } from "@/app/app/analyses/components/progress/AnalysisProgressPanel";
import { AnalysisDetailModal } from "@/app/app/analyses/components/modals/AnalysisDetailModal";
import { useAnalysisFilters, useFilteredAnalyses } from "@/app/app/analyses/hooks";

/** Displays the analyses list and coordinates its creation, filtering, and detail modals. */
export function AnalysesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detailId = searchParams.get("id");

  // B4 (PR #196 review) — this page's filters are client-side over the full corpus, so it
  // must fetch every row in one response, not one server-paginated page. See
  // `useAllAnalysesQuery` for why; #145 replaces this page with server-side filtering.
  const { data, isPending } = useAllAnalysesQuery();
  const { mutate: startAnalysis, isPending: isAnalyzing } = useAnalyzeContentMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const analyses = data?.analyses ?? [];
  const accounts = data?.accounts ?? [];
  // Ticket #144 blocker B2: this is the server's unfiltered count. With `useAllAnalysesQuery`
  // (B4) `analyses` already spans the full corpus in one response, so this equals
  // `analyses.length` in practice — kept as `pagination.total` (not derived) so it stays
  // correct even if this page's fetch strategy changes again before #145 lands.
  const serverTotalCount = data?.pagination.total ?? 0;

  const {
    filters,
    setDimension,
    toggleValue,
    removeValue,
    setKeyword,
    clearKeyword,
    clearAll,
    anyActive,
  } = useAnalysisFilters();
  // B4 fix: `analyses` is the full corpus (see `useAllAnalysesQuery` above), so `filtered`/
  // `counts` search every row, not just one server-paginated page. This client-side filtering
  // approach is a bridge for the OLD page only — #145 replaces it with server-side filtering.
  const { filtered, counts, totalCount } = useFilteredAnalyses(
    analyses,
    filters,
    accounts,
    serverTotalCount,
  );

  const handleClearSelection = useCallback(
    (dimension: Parameters<typeof setDimension>[0]) => setDimension(dimension, []),
    [setDimension],
  );

  // Opening the detail modal must merge `id` into the existing params rather than replacing the
  // URL outright — otherwise active filters are already gone by the time the modal opens, and
  // the merge-preserving close below has nothing left to preserve.
  const handleOpenDetail = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("id", id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, router],
  );

  // `AnalysisDetailModal`'s close must merge into existing params and drop only `id` — a hard
  // `router.push("/app/analyses")` would wipe every active filter param.
  const handleCloseDetail = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("id");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

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

  return (
    <>
      <div className="flex flex-col p-6">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Analyses</h1>
          <Button onClick={() => setModalOpen(true)}>New Analysis</Button>
        </div>

        {/* No fetch, no skeleton on filter change — filtering is synchronous over cached data
            (TDD §7.5). The bar itself is hidden while loading and when the account has zero
            analyses at all (design §5.1/§5.6), independent of filter state. */}
        {!isPending && analyses.length > 0 && (
          <div className="mb-5">
            <AnalysisFilterSection
              filters={filters}
              counts={counts}
              filteredCount={filtered.length}
              totalCount={totalCount}
              anyActive={anyActive}
              onToggle={toggleValue}
              onClearSelection={handleClearSelection}
              onRemove={removeValue}
              onSetKeyword={setKeyword}
              onClearKeyword={clearKeyword}
              onClearAll={clearAll}
            />
          </div>
        )}

        {/* Ticket #145 — the table now owns its own fetch (server-side pagination/sort,
            OR-8) and renders all four states (loading/empty/error) inside its own frame
            with the header intact (design §7), so it is rendered unconditionally here.
            `hasActiveFilters`/`onClearFilters` bridge this page's existing client-side
            filter bar (above) into the table's two distinct empty states; wiring real
            filters into the table's own server-side query is ticket #149's scope. */}
        <AnalysisDataTable
          onAnalysisClick={handleOpenDetail}
          onNewAnalysis={() => setModalOpen(true)}
          openAnalysisId={detailId}
          hasActiveFilters={anyActive}
          onClearFilters={clearAll}
        />

        <NewAnalysisModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSubmit={handleAnalyze}
          isAnalyzing={isAnalyzing}
        />

        <AnalysisProgressPanel progress={progress} onDismiss={() => setProgress(null)} />
      </div>

      {detailId && <AnalysisDetailModal id={detailId} onClose={handleCloseDetail} />}
    </>
  );
}
