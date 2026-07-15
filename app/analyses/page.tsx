"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AnalysisProgressPanel } from "@/components/AnalysisProgressPanel";
import { useAnalyses, useAnalyzeContent, useDeleteAnalysis } from "@/lib/api/analyses";
import type { ProgressState } from "@/lib/server/analysis/pipeline/progress";
import { AnalysisGrid, AnalysisGridSkeleton } from "./components/grids/AnalysisGrid";
import { AnalysisFilter } from "./components/sections/AnalysisFilter";
import { AnalysisEmpty } from "./components/sections/AnalysisEmpty";
import { NewAnalysisModal } from "./modals/NewAnalysisModal";

function AnalysesContent() {
  const router = useRouter();
  const { data, isLoading } = useAnalyses();
  const analyzeMutation = useAnalyzeContent();
  const deleteMutation = useDeleteAnalysis();
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

    analyzeMutation.mutate(
      { urls, prompt },
      {
        onSuccess: (result) => {
          setProgress({
            step: "complete",
            current: result.itemsAnalyzed,
            total: urls.length,
            message: `Analysis complete — ${result.itemsAnalyzed} item${result.itemsAnalyzed !== 1 ? "s" : ""} analyzed`,
          });
          toast.success("Analysis complete", {
            description: `${result.itemsAnalyzed} item${result.itemsAnalyzed !== 1 ? "s" : ""} analyzed${result.failedItems.length > 0 ? `, ${result.failedItems.length} failed` : ""}`,
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
    deleteMutation.mutate(id, {
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

      {isLoading ? (
        <AnalysisGridSkeleton />
      ) : analyses.length === 0 ? (
        <AnalysisEmpty onNewAnalysis={() => setModalOpen(true)} />
      ) : (
        <AnalysisGrid
          analyses={analyses}
          onAnalysisClick={(id) => router.push(`/analyses/${id}`)}
          onDelete={handleDelete}
          isDeleting={deleteMutation.isPending}
        />
      )}

      <NewAnalysisModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleAnalyze}
        isAnalyzing={analyzeMutation.isPending}
      />

      <AnalysisProgressPanel
        progress={progress}
        onDismiss={handleDismissProgress}
      />
    </div>
  );
}

export default function AnalysesPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <AnalysesContent />
    </Suspense>
  );
}
