import { MAX_SCORE } from "@/app/app/analyses/constants";

/**
 * DESIGN-3C §5 — the pips are `aria-hidden`; the numeral is the information. `n out of 5`
 * is the accessible text. For the Performance cell, the tier phrase and confidence word are
 * folded into ONE combined accessible name (rather than three separately-announced text
 * nodes) so a screen reader user hears the whole judgement in one utterance —
 * `Performance 4 out of 5, compared to their usual, high confidence`.
 *
 * The visible tier phrase reads `vs their usual` (a table label, terse by design); the
 * accessible phrase expands `vs` to `compared to` because a screen reader utterance is
 * heard once, not skimmed, and `vs` read aloud is ambiguous shorthand a sighted user can
 * resolve from context that an audio-only user cannot.
 */
export function buildScoreAccessibleLabel(params: {
  variant: "content" | "performance";
  score: number;
  tierPhrase?: string | null;
  confidenceWord?: string | null;
}): string {
  const axis = params.variant === "content" ? "Content" : "Performance";
  const parts = [`${axis} ${params.score} out of ${MAX_SCORE}`];

  const accessibleTierPhrase = toAccessibleTierPhrase(params.tierPhrase ?? null);
  if (accessibleTierPhrase != null) {
    parts.push(accessibleTierPhrase);
  }
  if (params.confidenceWord != null) {
    parts.push(params.confidenceWord);
  }

  return parts.join(", ");
}

function toAccessibleTierPhrase(tierPhrase: string | null): string | null {
  if (tierPhrase == null) return null;
  if (tierPhrase.startsWith("rough — vs ")) {
    return `a rough comparison, compared to ${tierPhrase.slice("rough — vs ".length)}`;
  }
  if (tierPhrase.startsWith("vs ")) {
    return `compared to ${tierPhrase.slice("vs ".length)}`;
  }
  return tierPhrase;
}
