"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAnalysesQuery, useAnalyzeContentMutation } from "@/lib/api/analyses";
import { ANALYSES_FETCH_ALL_PAGE_SIZE } from "@/lib/api/analyses/constants";
import type { ProgressState } from "@/app/app/analyses/components/progress/AnalysisProgressPanel/types";
import { AnalysisDataTable } from "@/app/app/analyses/components/grids/AnalysisDataTable";
import { AnalysisFilterSection } from "@/app/app/analyses/components/sections/AnalysisFilterSection";
import { NewAnalysisModal } from "@/app/app/analyses/components/modals/NewAnalysisModal";
import { AnalysisProgressPanel } from "@/app/app/analyses/components/progress/AnalysisProgressPanel";
import { AnalysisDetailModal } from "@/app/app/analyses/components/modals/AnalysisDetailModal";
import { useAnalysisFilters, useFilteredAnalyses } from "@/app/app/analyses/hooks";
import { buildFailureSummary } from "./helpers";

/** Displays the analyses list and coordinates its creation, filtering, and detail modals. */
export function AnalysesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detailId = searchParams.get("id");

  // PR #203 review, blocker 1 — this page's filter-bar counts and `AnalysisDataTable`'s own
  // rows both need the full corpus, and both build the exact same `{ pageSize }` params object
  // (this table's own `useAnalysesQuery` call), so TanStack Query dedupes the two hook calls
  // into ONE network request instead of two independent 5000-row fetches. B4 (PR #196 review)
  // is why the corpus is fetched in one response at all — `analyses` must be the full corpus for
  // the client-side filters to search more than one page. #266 (2026-08-20 owner ruling) removed
  // sorting entirely — there is no `sortBy`/`sortDir` left to keep in sync between the two call
  // sites; the server's fixed `updated_at DESC` order is the only order there is.
  const { data, isPending } = useAnalysesQuery({
    pageSize: ANALYSES_FETCH_ALL_PAGE_SIZE,
  });
  const { mutate: startAnalysis, isPending: isAnalyzing } = useAnalyzeContentMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const analyses = data?.analyses ?? [];
  const accounts = data?.accounts ?? [];
  // Ticket #144 blocker B2: this is the server's unfiltered count. With the full-corpus fetch
  // above (B4 / PR #203 review blocker 1), `analyses` already spans the full corpus in one
  // response, so this equals `analyses.length` in practice — kept as `pagination.total` (not
  // derived) so it stays correct even if this page's fetch strategy changes again before #145
  // lands.
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
  // B4 fix: `analyses` is the full corpus (see the `useAnalysesQuery` call above), so `filtered`/
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
          if (result.created === 0) {
            setProgress({
              step: "error",
              current: 0,
              total: result.requested,
              message: "No analyses were created",
              failures: result.failures,
            });
            toast.error("Analysis failed", {
              description: buildFailureSummary(result.failures),
            });
            return;
          }

          setProgress({
            step: "complete",
            current: result.created,
            total: result.requested,
            message: `Analysis complete — ${result.created} analyses created`,
            failures: result.failures,
          });
          const failureSummary = buildFailureSummary(result.failures);
          toast.success("Analysis complete", {
            description:
              result.failures.length > 0
                ? `${result.created} analyses created. ${failureSummary}`
                : `${result.created} analyses created`,
          });
        },
        onError: (error) => {
          setProgress((prev) =>
            prev
              ? { ...prev, step: "error", message: error.message || "Analysis failed", failures: [] }
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

        {/* Ticket #145 — the table owns its own fetch and renders all four states (loading/
            empty/error) inside its own frame with the header intact (design §7). Ticket #149 —
            `filters` (this page's URL-sourced filter state, `useAnalysisFilters` above) is now
            applied for real inside the table (see `AnalysisDataTable`'s own doc comment for the
            fetch-strategy trade this makes); `onClearFilters` still drives the empty-no-match
            state's action. */}
        <AnalysisDataTable
          onAnalysisClick={handleOpenDetail}
          onNewAnalysis={() => setModalOpen(true)}
          openAnalysisId={detailId}
          onClearFilters={clearAll}
          filters={filters}
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
