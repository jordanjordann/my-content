"use client";

import type { PatternsSectionProps } from "@/app/analyses/[id]/types";

export function AnalysisPatterns({ results }: PatternsSectionProps) {
  const { patterns } = results;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Patterns</h2>

      <PatternBlock
        title="Viral Formulas"
        items={patterns.viralFormulas}
        variant="default"
      />

      <PatternBlock
        title="Audience Psychology"
        items={patterns.audiencePsychology}
        variant="default"
      />

      <PatternBlock
        title="Recurring Red Flags"
        items={patterns.recurringRedFlags}
        variant="danger"
      />
    </div>
  );
}

function PatternBlock({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "default" | "danger";
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border p-4">
      <h3
        className={`mb-2 text-sm font-semibold ${
          variant === "danger" ? "text-red-500" : ""
        }`}
      >
        {title}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
