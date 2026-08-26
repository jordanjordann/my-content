// Ticket #279: lowering this limit was considered as a band-aid for
// `/api/analyze` running the batch sequentially, in-process, inside one
// HTTP request (a 10-URL batch measured at 7-18 min worst case, well past
// any reasonable single-request budget). Owner ruling (2026-08-26):
// rejected — this cap is a cost/fairness knob, not a timing one, and the
// real fix is Phase 3A (a job queue that returns 202 immediately and does
// the work in a background worker), which removes the request-duration
// constraint entirely. Shrinking this now would be a user-visible
// downgrade that 3A would immediately undo, and the frontend
// (`NewAnalysisModal`) still hardcodes "up to 10" copy regardless (#286).
// Left at 10 until 3A ships.
export const MAX_URLS_PER_BATCH = 10;
export const MAX_VIDEO_SECONDS = 900;
