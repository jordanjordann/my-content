import type { CtaTiming, CtaType, Pacing, StructureBeat, StyleAttributes } from "@/lib/api/analyses/types";

export type EnumValueBadgeProps = {
  label: string;
  identifier: string;
  emphasis?: "primary" | "muted";
};

export type StyleOverviewCardsProps = {
  style: StyleAttributes;
};

export type HookCardProps = {
  style: StyleAttributes;
};

export type CtaCardProps = {
  ctaType: CtaType[];
  ctaTiming: CtaTiming;
};

export type StructureBeatTimelineProps = {
  beats: StructureBeat[];
  pacing: Pacing;
  estimatedCutsPerMinute: number | null;
};

export type StyleTextDetailsProps = {
  onScreenText: string[];
  verbalTonePatterns: string[];
  captionStyleNotes: string;
};
