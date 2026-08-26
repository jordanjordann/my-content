// Ticket #279 (band-aid, not the real fix): `/api/analyze` runs the batch
// sequentially, in-process, inside one HTTP request, and is deployed on
// Railway where no `maxDuration` config is honored (see the route). Track
// B2 measured real per-analysis time live at 45-73s; using the 73s upper
// bound for safety, 4 URLs = 292s worst case, under a self-imposed ~5min
// UX budget we are choosing here (this is NOT a verified Railway edge-proxy
// timeout — that number is unconfirmed, see #279). 5 URLs would already be
// 365s (>6min) worst case, so 4 is the largest value that clears the
// budget. The real fix — a job queue with progress feedback instead of one
// long blocking request — is Phase 3A, unscoped as of this change.
export const MAX_URLS_PER_BATCH = 4;
export const MAX_VIDEO_SECONDS = 900;
