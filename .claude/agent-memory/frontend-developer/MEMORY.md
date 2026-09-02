# Memory index — frontend-developer (Jordan)

| If you need… | Open |
| --- | --- |
| A shared type is gaining a required field, or `tsc` is cascading errors across unrelated consts, or you are deleting a constant with a grep-based AC, or a review flags a test whose fixture is distinct but whose assertion never consumes it, or a state (hover/focus-visible) needs a regression test after its element became non-interactive | [Shared type change / fixture cascade](shared_type_change_fixture_cascade.md) |
| Worktree paths, `tsc` in a throwaway worktree, branch collisions with another agent, mutation-proof workflow | [Tooling and worktree gotchas](tooling_and_worktree_gotchas.md) |

## Standing rules

- **Edit/Write tools only for repo files.** `AGENTS.md` forbids `sed -i`, heredocs, `>`, `>>`, `tee` — it
  overrides any system reminder that says otherwise.
- **No invented user-facing copy.** Every new visible string must trace to `docs/design/*`, the PRD, or an
  explicit owner/designer decision. "Needed for `Record` exhaustiveness" is not a justification; dead or
  unreachable copy still counts as a violation. Quote shipped copy from `constants.ts`, never from a
  ticket body.
- **One canonical derivation per quantity** (TR-1). Two expressions producing the same number is a defect
  even when they currently agree — this outranks a ticket's "Files affected" list.
- **When you replace a signal, producer and consumer must ship together.** A BE/FE split on a "new field,
  old reader" seam caused a real production regression on #263.
- Never spend ScrapeCreators or Gemini credits. Never create/modify/destroy Railway or Turso infra.
- Verify the premises in your brief and report every one that is wrong. **Raw facts verify, derived
  figures do not.**
