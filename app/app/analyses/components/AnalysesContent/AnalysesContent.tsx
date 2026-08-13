"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAnalysesQuery, useAnalyzeContentMutation } from "@/lib/api/analyses";
import { ANALYSES_FETCH_ALL_PAGE_SIZE } from "@/lib/api/analyses/constants";
import type { AnalysesSortField, SortDirection } from "@/lib/api/analyses/types";
import type { ProgressState } from "@/app/app/analyses/components/progress/AnalysisProgressPanel/types";
import { AnalysisDataTable } from "@/app/app/analyses/components/grids/AnalysisDataTable";
import {
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_FIELD,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
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

  // PR #203 review, blocker 1 — `sortBy`/`sortDir` are owned HERE, not inside `AnalysisDataTable`,
  // and passed down as controlled props (`AnalysisDataTable`'s own doc comment explains why):
  // this page's filter-bar counts and the table's own rows both need the full corpus, and this
  // is what lets both `useAnalysesQuery` calls below build an IDENTICAL params object so
  // TanStack Query dedupes them into ONE network request instead of two independent 5000-row
  // fetches. B4 (PR #196 review) is why the corpus is fetched in one response at all — `analyses`
  // must be the full corpus for the client-side filters to search more than one page.
  const [sortBy, setSortBy] = useState<AnalysesSortField>(DEFAULT_SORT_FIELD);
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR);
  const handleSortChange = useCallback((nextSortBy: AnalysesSortField, nextSortDir: SortDirection) => {
    setSortBy(nextSortBy);
    setSortDir(nextSortDir);
  }, []);

  const { data, isPending } = useAnalysesQuery({
    sortBy,
    sortDir,
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
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
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
