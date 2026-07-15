"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AnalysisProgressPanel } from "@/components/AnalysisProgressPanel";
import { useAnalysesQuery, useAnalyzeContentMutation, useDeleteAnalysisMutation } from "@/lib/api/analyses";
import type { ProgressState } from "@/lib/server/analysis/pipeline/progress";
import { AnalysisGrid } from "../grids/AnalysisGrid";
import { AnalysisGridSkeleton } from "../grids/AnalysisGridSkeleton";
import { AnalysisFilter } from "./AnalysisFilter";
import { AnalysisEmpty } from "./AnalysisEmpty";
import { NewAnalysisModal } from "@/app/analyses/modals/NewAnalysisModal";

/** Main analyses page: list, filter, create, and delete operations. */
export function AnalysesContent() {
  const router = useRouter();
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
          setProgress({
            step: "complete",
            current: result.itemsAnalyzed,
            total: urls.length,
            message: `Analysis complete — ${result.itemsAnalyzed} items analyzed`,
          });
          toast.success("Analysis complete", {
            description: `${result.itemsAnalyzed} items analyzed${result.failedItems.length > 0 ? `, ${result.failedItems.length} failed` : ""}`,
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

  const handleDismissProgress = () => {
    setProgress(null);
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analyses</h1>
        <div className="flex items-center gap-3">
          <AnalysisFilter
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
        <AnalysisEmpty onNewAnalysis={() => setModalOpen(true)} />
      ) : (
        <AnalysisGrid
          analyses={analyses}
          onAnalysisClick={(id) => router.push(`/analyses/${id}`)}
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

      <AnalysisProgressPanel
        progress={progress}
        onDismiss={handleDismissProgress}
      />
    </div>
  );
}
