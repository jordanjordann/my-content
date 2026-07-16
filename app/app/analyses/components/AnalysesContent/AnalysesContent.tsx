"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAnalysesQuery, useAnalyzeContentMutation, useDeleteAnalysisMutation } from "@/lib/api/analyses";
import type { ProgressState } from "@/app/app/analyses/components/progress/AnalysisProgressPanel/types";
import { AnalysisDataTable } from "@/app/app/analyses/components/grids/AnalysisDataTable";
import { AnalysisGridSkeleton } from "@/app/app/analyses/components/grids/AnalysisGridSkeleton";
import { AnalysisFilterSection } from "@/app/app/analyses/components/sections/AnalysisFilterSection";
import { AnalysisEmptySection } from "@/app/app/analyses/components/sections/AnalysisEmptySection";
import { NewAnalysisModal } from "@/app/app/analyses/components/modals/NewAnalysisModal";
import { AnalysisProgressPanel } from "@/app/app/analyses/components/progress/AnalysisProgressPanel";
import { AnalysisDetailModal } from "@/app/app/analyses/components/modals/AnalysisDetailModal";

/** Displays the analyses list and coordinates its creation and detail modals. */
export function AnalysesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailId = searchParams.get("id");

  const { data, isPending } = useAnalysesQuery();
  const { mutate: startAnalysis, isPending: isAnalyzing } = useAnalyzeContentMutation();
  const { mutate: removeAnalysis, isPending: isDeleting } = useDeleteAnalysisMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const analyses = data?.analyses ?? [];
  const accounts = data?.accounts ?? [];

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
          <div className="flex items-center gap-3">
            <AnalysisFilterSection
              accounts={accounts}
              selectedAccount={selectedAccount}
              onSelect={setSelectedAccount}
            />
            <Button onClick={() => setModalOpen(true)}>New Analysis</Button>
          </div>
        </div>

        {isPending ? (
          <AnalysisGridSkeleton />
        ) : analyses.length === 0 ? (
          <AnalysisEmptySection onNewAnalysis={() => setModalOpen(true)} />
        ) : (
          <AnalysisDataTable
            analyses={analyses}
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
