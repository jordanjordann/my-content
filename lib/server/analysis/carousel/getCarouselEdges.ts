import type { ScrapeCreatorsMedia } from "@/lib/server/scrapecreators";
import type { CarouselEdge } from "./types";

/**
 * The ONE canonical derivation of a carousel's slide positions and count
 * (tech-lead ruling on #175/#176, recorded as TDD §0.7 TR-1/TR-2). Returns
 * the PRE-FILTER `edge_sidecar_to_children.edges` array, unchanged —
 * including any entries whose `node` is falsy/null.
 *
 * Every slide COUNT in the codebase is `getCarouselEdges(raw).length`.
 * Every slide INDEX is an index into this array. No count and no index may
 * ever be derived from a filtered/compacted array — doing so silently
 * shifts every index after a null node down by one and shrinks the count,
 * printing a confidently wrong slide number (F1/F2/F3, #175).
 *
 * Promoted out of `performance/reach.ts` (where it originated, PR #167) into
 * this neutral module — depending only on the schema types — so that
 * `fetcher/adapter.ts` and `media/resolveMediaParts.ts` can depend on it
 * without importing the performance layer. That would be a dependency
 * inversion: the fetcher/adapter and media layers sit BELOW performance,
 * not above it.
 */
export function getCarouselEdges(raw: ScrapeCreatorsMedia): CarouselEdge[] {
  const edges = raw.edge_sidecar_to_children?.edges;
  return Array.isArray(edges) ? edges : [];
}
