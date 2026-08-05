# Handoff — my-content (session 2)

> **Superseded by `docs/HANDOFF-2026-07-23.md`. Read that one first.**

**Session:** 2026-07-22 (session 2)
**Repo:** `/Users/jordanatha/Desktop/Projects/my-content` · github: `jordanjordann/my-content`
**Branch:** `main`, at `f181f53`. **Zero open PRs** (other than the one carrying this document).

Supersedes `docs/HANDOFF-2026-07-22.md`, which now carries a pointer at the top. Do not plan from it.

---

## Read these first — do not re-derive

| Path | What it holds |
|---|---|
| `docs/RUNBOOK.md` | Commands, auth/PIN, **full env var table**, DB + migration state, **API credit costs**, fixture inventory, testing. Re-verified this session |
| `.claude/context/verified-facts.md` | Live-verified ScrapeCreators + Gemini facts. **Append, never clobber** — see traps |
| `.claude/context/fixtures/` | 10 YouTube + **6 Instagram** real captures + the Gemini structured-output harness. Validate against these; do not re-burn credits |
| `docs/PRD-analysis-schema-redesign.md` | The settled analysis contract. §12 empty — no open questions |
| `docs/TDD-analysis-schema-redesign.md` | Implementation design. §12 corrected this session; two of the five open items are now answered |
| `docs/design/DESIGN-analysis-tier1-style-section.md` + `analysis-tier1-style-mockup.html` | Confirmed UI direction A (tabbed) + 9 sub-decisions. #70 implements it |
| `docs/product-direction-plan.md` / `-open-questions.md` | Roadmap and the grilling-session answers |

Ticket detail is in GitHub issues — `gh issue list`. Don't restate them.

---

## Product, in one paragraph

Content analysis tool for an **Indonesian social-media/marketing agency** (the user is the agency, not the creator). Paste an Instagram Reel or YouTube Short → ScrapeCreators fetches metadata → video downloaded → Gemini watches and analyses → stored. Destination is a **content brief generator**: name a topic, get a brief written in a specific creator's style learned from ≥5 of their analysed videos. Not a calendar, not a scheduler. Output language Indonesian; UI English. Desktop dashboard.

---

## What changed this session

Five merges, all on `main`:

| Commit | PR / ticket | |
|---|---|---|
| `40e1a32` | #80 / #75 | Gemini SDK migration — **`@google/generative-ai` (EOL) is gone**, `@google/genai@^2.13.0` is in |
| `e5c6fb5` | #79 / #65 | Taxonomy module — isomorphic enums, Indonesian labels, schema version constant |
| `7c11ccb` | #82 / #54 | YouTube fetcher metadata path onto ScrapeCreators (yt-dlp kept for the video URL) |
| `c9aa806` | #84 | Live Instagram fixtures + RUNBOOK migration-state correction |
| `f181f53` | #81 / #64 | Test harness — **the repo went from ZERO tests to a real suite** |

Three consequences worth stating plainly:

1. **Tests exist.** vitest, `npm run test`, 4 files, 82 `it()` declarations (~85 cases once `it.each` expands). Offline **by construction**: `tests/setup/blockLiveFetch.ts` stubs `fetch` to throw unless a test opts in. RUNBOOK §7.
2. **Six real Instagram fixtures exist**, including the **first ever video-bearing carousel** (`ig_carousel_mixed_video_and_image_10_slides.json`, 7 video + 3 image children). It **falsified** the modelled carousel-child type — see #71.
3. The EOL Gemini SDK is fully removed. `response.text` semantics changed — see traps.

---

## Owner decisions made this session — do not relitigate

- **Schema version stays a literal `2`.**
- **Indonesian label "Performa" is KEPT.** The owner is the native speaker. **Do not re-raise this.**
- **`finishReason` throw is KEPT** — generate throws on `MAX_TOKENS` before anything parses.
- **CTA helpers stay in the taxonomy module.**
- **Node pinned to 24.14.1.**
- **ScrapeCreators key rotation is DEFERRED.** The key was pasted in plaintext in an earlier session and **is still exposed**. Outstanding risk, owner's call, not an agent's.
- **#71 Q1–Q4, all answered:** Q1 = (a) nullable `durationSec` (null for carousel video parts; the guard **skips**, never coerces to 0) · Q2 `dash_info` **deferred with a documented comment in the type**, not silently absent · Q3 **`MAX_MEDIA_PARTS = 20`** · Q4 = (c) **store both** `video_play_count` and `video_view_count`, **display views**.
- **#71 C9 co-author data — _"just store the data for now, but keep it away from analysis"_** (owner, verbatim). Sequence, because the issue looks contradictory otherwise: an agent **struck C9 out of #71 entirely without owner approval** and replaced it with an **inverted** criterion ("reviewer confirms `coauthor_producers` appears nowhere in the diff"). The owner has now **partially restored it** — the field **IS persisted**, and **must not** reach Gemini, the prompt, or any analysis output. The inverted criterion was **removed as wrong**; the original C9 criteria are restored. **Cheap path:** it is already inside `raw_payload`, so "store it" may be zero work; a dedicated column is a **scoping call to RAISE**, not to fold silently into 008. **The strike-throughs you will find on #71 are annotated history, not live scope.**
- **Max 2 concurrent agents.**

---

## What is genuinely ready to start

Labels were reconciled against `main` this session; the list below is the verified state, not the label history.

**Ready now, three-way parallel:**

- **#57** — YouTube profile resolution / engagement rate. All four blockers on its banner are cleared: #53 (`0798176`), #54 (`7c11ccb`), the yt-dlp injection fix (`5d0a856`), and the "~10 credits" note (balance is **31,994**). ⚠️ **Must land before #69** — they collide in `lib/server/analysis/pipeline/index.ts` and #57 is the smaller edit.
- **#66** — Gemini structured output. Blockers #65 and #75 both merged.
- **#67** — prompt rewrite. Blocker #65 merged. Parallel with #66.
- **#83** — GitHub Actions CI. Blocker #81 merged. Independent of everything. Note its no-network guard is **already built** by #81; scope shrinks to the workflow file.

**Then, in this order — this is the true chain:**

`#66` + `#67` → **#68** (parser/validation rewrite) → **#69** (pipeline + migration 007) → **#70** (FE) → **#71** (carousel) / **#72** (fingerprint) → **#73** (fingerprint API) → **#74** (QA).

**#69 and #70 ship in the SAME deploy.** #71 and #72 are parallel with each other once #69 lands.

**#71 is still `blocked` — on #69 alone** (and see trap **0**: #69 creates migration 007, without which #71's 008 rebuild cannot be written safely)**.** Its other two blockers (PR #84's fixture, #64's harness) are cleared and its four owner questions are answered. The "#84 + #64" reading of its dependency line is incomplete; #69 is in the list too, and #69's own body says "Blocks #70, #71, #72".

---

## The traps that will bite

**0. ⛔ HARD BLOCKER — there is NO `007` migration on `main`.** Verified this session: `migrations/` stops at `006_scrapecreators_fields_and_profiles.sql`. **#69 is the ticket that creates 007.** #71 instructs migration **008 to reproduce "every column from 004/006/007"** — so **008 cannot be written until #69 lands and 007's column list is known.** A SQLite table rebuild (`CREATE new` → `INSERT SELECT` → `DROP` → `RENAME`) written against a **guessed** schema **silently drops columns**: no error, no warning, data gone. This is an **ordering constraint, not a preference**, and it independently confirms **#71 must wait on #69** regardless of labels. Before starting 008: `ls migrations/` and confirm `007_*.sql` exists, then read its full column list.

1. **#69 + #70 must merge AND deploy together.** The 1–5 rescale touches seven files, including a **second, independent copy of the colour thresholds in `AnalysisDataTable.tsx`** and a radial gauge computing `(overallScore / 10) * 327`. Any window where #69 has shipped and #70 has not is a visibly broken app.
2. **Thinking tokens count against `maxOutputTokens`.** Proven: 38 output + 48 thinking → `finishReason: MAX_TOKENS`, JSON truncated mid-string. Inspect `finishReason` and **throw before parsing**. Log `usageMetadata` on every call.
3. **`response.text` is a PROPERTY on `@google/genai`, not a method.** A forgotten `()` does not throw — it stringifies a function reference into `result_content`. Assert `typeof text === "string"`. Likewise `GoogleAIFileManager` and the `@google/generative-ai/server` entry point no longer exist.
4. **`.claude/context/verified-facts.md` is append-only with multiple writers, and is now internally contradictory in places.** Superseded claims are **annotated, not deleted**, and the file is not strictly chronological — e.g. the "#64, second-hand, no raw capture committed" Instagram section sits *below* the first-hand captures that supersede it and is flagged `⚠️ PARTIALLY SUPERSEDED` inline. Read the whole endpoint section before trusting any one paragraph. Still: **append, never clobber.**
5. **`my-content.db` is tracked in git despite being gitignored.** Tracking wins, so local runs dirty the tree. **Do not commit it.**
6. **#57 vs #69 and #71 vs #54** are the two file-level collisions. #54 already merged, so #71 rebases onto it.

---

## Open items requiring the owner

**#71 has no open questions.** These do:

- **Co-authored posts and the style fingerprint (#72).** Do posts co-authored with another account count toward a creator's style fingerprint? Our only single-creator sample is **40% co-authored**, and **5 posts is exactly the style-inference threshold** — so this is not a hypothetical, it decides whether that sample qualifies at all. **STILL OPEN.** ⚠️ The 2026-07-22 C9 decision ("store the data, keep it out of analysis") governs the co-author **data only** and does **NOT** answer this. **Needs a home; deliberately NOT ticketed** (duplicate-ticket history) and **#72 was not edited**.
- **The `username` split-account bug.** #82 changed YouTube `analyses.username` from the channel display name to the **handle**, with **no backfill**. `getUniqueAccounts()` (`lib/server/db.ts`) is a bare `SELECT DISTINCT username FROM analyses`, so any channel analysed both before and after #82 shows up as **two creators** in the UI account filter. **Needs a ticket** (not created this session — see the note at the bottom).
- **`credits_charged` / spend visibility.** Nothing tracks spend today. `credits_remaining` is returned on every ScrapeCreators response and discarded unread. No budget alarm exists.
- **Scoping call on #71 Q4.** **[CORRECTED]** Storing both counts is **ONE new column, not two.** `analyses.view_count` **already exists** — `content_items.view_count` in `001_initial.sql`, moved onto `analyses` by `004_flatten_analysis_content.sql` (`ALTER TABLE analyses ADD COLUMN view_count INTEGER`) and reproduced in the `005` rebuild. **Only `play_count` is new.** Do not re-add, rename or duplicate `view_count`. Whether `play_count` rides along in 008's rebuild is still a call the implementer must **RAISE, not fold in silently.** Also: the "display views" half of Q4 is **already how the code behaves** — `lib/server/analysis/fetcher/adapter.ts:211` reads `video_view_count` only (`const viewCount = num(raw.video_view_count);`). No change needed there; the work is the reel `video_play_count` fallback, not the display rule.

---

## Nothing has been verified against a live API call this entire session

Every one of the five merges passed on **typecheck, lint and fixtures only**. Zero ScrapeCreators calls, zero Gemini calls.

Thinnest spots, in order:

1. **Gemini's resumable file-upload handshake** on `@google/genai` — cannot be exercised offline at all. `.claude/context/fixtures/gemini/structured-output-baseline.mjs` was ported by #75 but **has not been run since the port**.
2. **#82's age-restricted → `metadata_only` degradation** — never executed.

**Recommendation: one real Short and one real analysis, deliberately, early.** `/v1/youtube/video` costs 1 credit on success and **0 on 404**; `/v1/youtube/channel` costs 1 credit **even when it fails**. Budget: **31,994 credits**.

---

## The agent-model issue, honestly

`model:` in `~/.claude/agents/*.md` is a **DEFAULT, not a ceiling.** The Agent tool's `model` parameter overrides it. Roughly **10 agents ran on opus this session** against configured sonnet defaults.

Ticket **#85** proposed a PreToolUse hook to forbid the override. **Two backend agents refused to implement it**, on the grounds that no agent-to-agent message can authorise editing permission or configuration files. **#85 was CLOSED at the owner's direction.**

The only viable paths are:
1. **The owner edits `.claude/settings.json` himself**, or
2. **The owner instructs the top-level agent directly.**

**Do not let the next session re-attempt this via a subagent.** It will be refused again, correctly, and cost a round trip.

---

## A merge-policy gap — for the owner to decide

PRs **#79, #80, #81, #82 and #84 were all merged by agents after agent code-review, with no human approval on GitHub.** The last merge tripped a security warning. Stated neutrally: this is a policy question — whether agent review is sufficient to merge, or whether human approval should gate `main`. No policy exists today, so the default is "agents merge".

---

## Orchestration lessons

- **Brief once, completely. Spawn fresh with `isolation: "worktree"`** rather than amending in increments. Continuing an agent by follow-up message spawns a fresh lineage that loses both specialist identity and worktree isolation.
- **Agents hit session limits twice.** Work survived **only because it lived in git worktrees, not agent memory** — **PR #84 was recovered from a worktree after its agent died mid-task.**
- **Prune worktrees with `gh pr list --state merged`, not `git merge-base`.** Squash-merge hides ancestry, so `merge-base --is-ancestor` will not detect merged work.
- **Max 2 concurrent agents.**

---

## Deferred, with triggers (unchanged)

- **Auth / multi-tenancy** — trigger is *"the app stops being local-only"*. A 4-digit PIN is the only gate; measured brute-force ≈17h via sub-threshold probing.
- **Longitudinal metric snapshots** — `profiles.follower_count` is overwritten on upsert, so history is being destroyed. Cheap to start recording, impossible to backfill. The same argument drove #71 Q4 = "store both".
- **Rate-limiter polish** — deliberately dropped; PIN-specific code with a scheduled demolition date.

---

## Housekeeping done this session (so you don't redo it)

- Labels reconciled against `main`: #66, #67, #57 `blocked` → `ready-for-agent`; #71 stays `blocked` (on #69 only); #83 lost the off-convention `enhancement` label.
- Reconciliation comments left on #23, #24, #36, #38, #57, #66, #67, #71, #83.
- `.env.example` rewritten — it was missing every rate-limit var, `TRUST_PROXY_HEADERS` and the image-proxy vars, and advertised `RESET_PIN=your-reset-pin` when the code compares against the literal `"true"`.
- `docs/TDD-analysis-schema-redesign.md` — `@google/generative-ai` prose corrected, §7.6 and §12 marked with the answers.
- `docs/HANDOFF-2026-07-22.md` — superseded banner added, not deleted.

**Recommended tickets NOT created** (deliberately — duplicate ticket history has cost this project two reconciliation passes already): the `username` split-account backfill/normalisation fix; converting the adapter tests onto the six real Instagram fixtures; `credits_remaining` spend visibility.

**Possible closures, left open for the owner:** **#36** (its purpose — confirming the live Instagram response shape — is now answered by the committed fixtures; running it would burn credits to re-derive known facts). **#38** and **#24** (old manual QA passes; #24 in particular will need re-running after #70 rewrites the table). Rationale is in a comment on each.

---

## Suggested skills for the next session

- **`development-cycle`** — the standing process; #57/#66/#67/#83 are ready to run.
- **`tdd`** — a real runner now exists; #68 (parser/validation rewrite) is the ticket where it pays most.
- **`create-pull-request`** / **`create-commit`** — routine, high volume.
- **`frontend-design`** or **`ui-ux-pro-max`** — for #70, Direction A tabbed modal.
- **`retrospective`** — the agent-model issue and the merge-policy gap both deserve formalising.

---

## Secrets

`SCRAPECREATORS_API_KEY` and `GEMINI_API_KEY` live in `.env.local` (gitignored, untracked). No keys are reproduced in this document. **The ScrapeCreators key was pasted in plaintext in an earlier chat session and rotation is still deferred — it remains exposed.**
