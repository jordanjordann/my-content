"use client";

import { Suspense } from "react";

import { DetailContent } from "./components/sections/DetailContent";

export default function AnalysisDetailPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <DetailContent />
    </Suspense>
  );
}
