"use client";

import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";

import { useAnalysis } from "@/lib/api/analyses";
import { AnalysisDetailHeader } from "./components/header/AnalysisDetailHeader";
import { AnalysisScorecard } from "./components/sections/AnalysisScorecard";
import { AnalysisPerItem } from "./components/sections/AnalysisPerItem";
import { AnalysisPatterns } from "./components/sections/AnalysisPatterns";
import { AnalysisSuggestions } from "./components/sections/AnalysisSuggestions";

function DetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data, isLoading, error } = useAnalysis(id);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-32 w-full animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">
          {error ? "Failed to load analysis." : "Analysis not found."}
        </p>
        <button
          onClick={() => router.push("/analyses")}
          className="text-sm text-primary hover:underline"
        >
          Back to Analyses
        </button>
      </div>
    );
  }

  const results = data.results;

  return (
    <div className="flex flex-col gap-6 p-6">
      <AnalysisDetailHeader
        analysis={data}
        onBack={() => router.push("/analyses")}
      />

      {results ? (
        <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
          <div className="flex flex-col gap-6">
            <AnalysisScorecard results={results} />
          </div>

          <div className="flex flex-col gap-6">
            <AnalysisPerItem items={data.items} results={results} />
            <AnalysisPatterns results={results} />
            <AnalysisSuggestions results={results} />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          No analysis results available.
        </div>
      )}
    </div>
  );
}

export default function AnalysisDetailPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <DetailContent />
    </Suspense>
  );
}
