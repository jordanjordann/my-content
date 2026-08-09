import type { ScrapeCreatorsCarouselChildNode } from "@/lib/server/scrapecreators";

/**
 * One entry of a carousel's PRE-FILTER `edge_sidecar_to_children.edges`
 * array. `node` is optional/nullable on the real payload — a falsy `node`
 * must be `continue`d past, never filtered out before indexing or counting
 * (TDD §0.7 TR-1/TR-2, tech-lead ruling on #175/#176).
 */
export type CarouselEdge = { node?: ScrapeCreatorsCarouselChildNode };
