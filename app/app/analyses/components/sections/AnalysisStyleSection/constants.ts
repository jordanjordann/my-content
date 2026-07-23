import type { CtaTiming } from "@/lib/api/analyses/types";

/** Ordered CTA-timing steps for the "Awal / Tengah / Akhir" strip. `NONE` renders as no highlight. */
export const CTA_TIMING_STEPS: { value: CtaTiming; label: string }[] = [
  { value: "EARLY", label: "Early" },
  { value: "MID", label: "Mid" },
  { value: "END", label: "End" },
];
