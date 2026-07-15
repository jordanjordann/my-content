"use client";

import { Suspense } from "react";

import { AnalysesContent } from "./components/sections/AnalysesContent";

export default function AnalysesPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <AnalysesContent />
    </Suspense>
  );
}
