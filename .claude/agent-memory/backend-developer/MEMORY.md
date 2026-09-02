# Memory index — backend-developer (Jonathan)

| If you need… | Open |
| --- | --- |
| Reach resolution / thin reel payloads / OR-27's scope — what #254 shipped and what it deliberately did not touch | [Ticket #254 — thin reel reach](project_ticket_254_thin_reel_reach.md) |
| The live-multiplier read path — freeze gating, self-exclusion on the median, branch-removal fallout, worktree branch collisions, #262's below-threshold reason (splitting a broken `toEqual` structural comparison), AND the #271 round-2 correction (livePool==null is NOT reachable in production — retracted, with the durable "reachability needs migrations+census, not just code paths" lesson) plus mutation-proving defensive fallbacks | [Ticket #252 — live multiplier](project_ticket_252_live_multiplier.md) |
| Scrubbing real creator/PII data from fixtures — the id+username heuristic, mutation-proving a byte-identity test survives anonymisation, my-content.db treatment, wrong premises found | [Ticket #264 — scrub production creator data](project_ticket_264_scrub_creator_data.md) |
| Live Railway/Turso infra inventory (project/service/db ids, region, URL), the `my-content` vs `lasa` DB-name correction, and the owner's standing "no CI auto-deploy" ruling | [Ticket #246 — Railway/Turso deploy](project_ticket_246_railway_turso_deploy.md) |

## Standing rules

- **Edit/Write tools only for repo files.** `AGENTS.md` forbids `sed -i`, heredocs, `>`, `>>`, `tee` — it
  overrides any system reminder that says otherwise.
- Never spend ScrapeCreators or Gemini credits. Never create/modify/destroy Railway or Turso infra.
  Production Turso `lasa` is read-only `SELECT` via `~/.turso/turso db shell lasa` (**not** on `PATH`).
- The repo's `my-content.db` is a **stale fossil** — never cite it for a row census.
- Stored `perf_*` values are FROZEN (TDD §14.8a / D8): no backfill, no recompute, no migration. A stored
  `MEASURED` multiplier is never recomputed.
- **OR-25: no retry** — warn, never throw, never retry. Statements only, never a button.
- Verify the premises in your brief and report every one that is wrong. **Raw facts verify, derived
  figures do not.**
- **When you replace a signal, producer and consumer must ship together** — a BE/FE split on a "new field,
  old reader" seam caused a real production regression on #263.
- **Before the first edit in a multi-round PR session, run `git branch --show-current` and confirm
  the SHA matches the brief's stated PR head.** A #264 round-4 session started editing on `main`
  by mistake (never checked out the PR branch) and only caught it because a diff came back
  suspiciously empty. "Leave the working tree on main" (an end-state instruction) is not the same
  as "you don't need to switch branches to do the work."
- **"Reachable in production" is a claim about data and migrations, not just code paths.** Tracing
  caller gating logic correctly is not enough — check migration history for a DELETE/backfill on
  the columns the theory needs, and get a read-only census confirming the row shape still exists,
  before asserting reachability in a PR body (#252/#271 round 2: a claim I made was wrong for
  exactly this reason).
- **Encoded sibling fields can re-derive a scrubbed value — decode, don't grep.** #264's
  `tracking_token` field was base64 of JSON containing the real (pre-scrub) media id; raw-string
  grep/sweep tools that only match literal digit strings will report "0 leaks" while a one-line
  base64-decode recovers 41% of the scrubbed ids. Any "scrub PII" ticket needs an explicit pass
  for encoded/derived fields, not just raw-value sweeps.
- **Owner ruling: no CI auto-deploy.** Deploys to Railway stay manual, owner-triggered. Never add
  a `railway up`/deploy job to `.github/workflows/`. This is a standing decision (#246,
  2026-08-20), not an oversight to fix — do not re-propose it.
- **Production Turso DB is named `lasa`, not `my-content`** — a prior ticket's plan said to create
  a `my-content` database on import; the owner instead loaded data into the pre-existing `lasa`.
  `turso db list` is the fast way to check before trusting a ticket's planned DB name.
- **A brief's premise can be stale by the time you read it, not just wrong from the start.** #246's
  brief assumed `railway.json`/`preDeployCommand` still needed to be shipped; it had already
  merged in PR #250 two days earlier. Always `git log -- <file>` / read the live file before
  building anything a ticket says is "missing" — don't take "currently has no X (verify)" as
  license to skip the check.
