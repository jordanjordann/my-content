# Committed API fixtures — do not delete these

Everything under this directory is a **real, credit-charged API capture**, not a placeholder or a
generated file. ScrapeCreators is credit-based (~25k credits remaining as of 2026-07-21 — see
`docs/RUNBOOK.md` §5), and re-capturing a deleted fixture costs credits again (`/v1/youtube/channel`
even charges on a *failed* lookup). Do not delete, rename, or hand-edit any file here without a
reason recorded in `.claude/context/verified-facts.md` or `tests/fixtures/README.md`.

- `scrapecreators-youtube/` — 10 real `/v1/youtube/video` and `/v1/youtube/channel` captures
  (2026-07-21, ticket #53/#63). Referenced by `tests/helpers/fixtures.ts`, which throws a clear
  error naming the missing file (and its resolved path) if any of these go missing — see
  `loadJsonFixture()`.
- `gemini/` — `structured-output-baseline.mjs`, a Gemini structured-output harness (not JSON
  captures; see `docs/RUNBOOK.md` §6).

`scrapecreators-instagram/` does not exist yet in this branch. PR #84 (open, not merged as of this
writing) adds real Instagram fixtures there. When it lands, do not clobber this directory's YouTube
or Gemini contents — append/merge, per the same append-only discipline as
`.claude/context/verified-facts.md`.
