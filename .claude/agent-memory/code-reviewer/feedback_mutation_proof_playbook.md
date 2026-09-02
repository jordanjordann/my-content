---
name: mutation-proof-playbook
description: The ten recurring fake-guard forms, the env-gated mutation harness, how to verify a form-10 fix (three mutants, not one), and the rule that a mutation result is never read off a developer's report
metadata:
  type: feedback
---

Merged from the former `feedback_mutation_proof_reviews`, `feedback_double_gated_assertions`,
`feedback_sibling_endpoint_coverage`, `feedback_sdk_boundary_tests`, `feedback_env_gated_mutation_harness`,
`feedback_verify_mutations_independently`, and the #263 `review-mutation-testing` note.

## 0. The rule

**Never read a mutation-test outcome, test count, or "killed/survived" verdict off a developer's PR body
or report.** Re-apply the mutation with the Edit tool, re-run the suite yourself, revert with the Edit tool
(never `git checkout --`). This project has twice had a reported "mutation killed" that survived when
re-run independently; reported numbers have also disagreed with reality on test-file counts.

Beyond the mutations the developer anticipated, **always run at least one they did not**.

A **surviving mutation where the observable contract still holds** is a test-quality finding, not a
correctness bug, and should not block a merge on its own. Distinguish severity honestly.

**Before calling a survivor a coverage gap, prove the mutated value is observable at all.** A survivor has
two causes — no test watches it (a gap), or *nothing* watches it (a dead expression) — and they get
opposite verdicts. Two cheap checks, both grep-only: (a) is the field in the **SET clause / arg list** of
the statement that supposedly persists it, and (b) does the receiving function *use* it, or only spread it
into its return object? On PR #302 I filed an `audienceSourceFetchedAt` survivor as a missing assertion;
it was dead — the YouTube-upgrade `UPDATE analyses` omits that column entirely and `computeBlock` passes
the field through untouched, so the mutant persisted nothing. Its sibling `profileId` at the *same* call
site was live, because it feeds a computation whose outputs (`perf_baseline_*`) *are* in the SET clause.
Same site, same shape, opposite answers. This is form 9 of [[verify-the-brief]] turned on my own review.

## 1. The recurring fake-guard forms (note: two items are both numbered 10 — 11 forms in total)

1. **Unreachable assertion** — the test dies at an earlier assertion, so the assertion that supposedly
   pins the claim never runs.
2. **Non-binding assertion** — the asserted string/value is present under the mutant too (e.g. asserting
   `"5. image"` against an all-image fixture, where every element shares the same label). Fixtures must
   make the pinned element **distinguishable** from its neighbours.
3. **Self-referential assertion** — the expected value is imported from the same module the component
   renders from, so corrupting the constant satisfies the assertion trivially. This project has hit it
   three times; the fix is a hardcoded literal twin. Sweep every test file in the diff for imports of the
   constants under test.
4. **Substring assertion** — `toHaveTextContent(...)` matches a substring, so approved copy is checked
   against *truncation* but never against *appended* text. On PR #234 the round-2 fix killed truncation,
   substitution, inversion and whole-column swap, yet `"Views or plays on this post"` →
   `"Views or plays on this post, estimated"` still passed 837/837. For exact approved copy, require
   `expect(el.textContent).toBe(...)`.
5. **Unpinned element set** — every rendered string is asserted exactly, but nothing asserts *how many*
   elements are rendered, so copy can still grow by **adding a node**. On PR #234 round 3, after all six
   copy assertions were converted to `expect(el.textContent).toBe(...)`, appending a fourth `<p>` to the
   tooltip (invented copy contradicting the approved string next to it) still passed 837/837, as did a
   third `<p>` inside the operand stack. Positional selection (`querySelectorAll(":scope > p")` then
   `[0][1][2]`) is what enables this: a node added at the end shifts nothing. Fix is one line —
   `expect(nodes).toHaveLength(n)` before destructuring, which also makes the positional indexing fail
   loudly on structural change.
6. **Double-gated assertion** — an integration/route-level test claims to pin a gate, but a *second,
   independent* gate upstream enforces the same thing, so mutating the gate under test leaves the test
   green. On PR #235 the route-level test "a MEASURED row's `tier2.sampleSize` does not move" stayed green
   when `readModel.ts`'s `const isColdStart = row.perfMultiplier == null` was hardcoded to `true` —
   because both API routes independently refuse to inject a live value for a MEASURED row. Only the
   `readModel.test.ts` unit test went red. The behaviour was genuinely safe, but the test passed for a
   different reason than its name claims. **When a mutation kills *fewer* tests than the author's report
   claims, identify which layer detected it and say so.** If the killing test is a unit test and the
   integration test named after the behaviour survived, report the integration test as non-binding.
7. **Uncovered sibling call site** (the inverse of form 6) — a feature implemented at two call sites that
   mirror each other (`app/api/analyses/route.ts` list endpoint and `app/api/analyses/[id]/route.ts`
   detail endpoint) almost always has coverage on the first only. On PR #235 round 2, both
   `liveColdStartSampleSize = eligibleIds.size` (drops self-exclusion, off-by-one on a user-visible
   counter) and `liveColdStartSampleSize = null` (feature absent, silently falls back to the frozen
   column) passed 829/829 at the detail route; the list endpoint's equivalent mutation went red
   immediately. The author's report said "route self-exclusion subtraction — caught", true of one route
   and silently untrue of the other. **Whenever a diff touches two parallel route/handler files, run each
   mutation at *both* sites separately, never once "at the route layer".** Check whether the second site
   is reachable from the FE (`lib/api/*/api.ts` + `hooks.ts`) before deciding severity.

8. **Predicate twin inside a `vi.mock` factory** — a test mocks a module (`vi.mock("@/lib/server/analysis/gemini")`)
   and, for one export, hand-writes a reimplementation in the factory, often labelled "real implementation,
   not a mock". It is a **copy**, so mutating the real function leaves that file green. On PR #299 round 2
   both `hasVideoModalityEvidence` mutations (`> 0` → `>= 0`; modality check dropped) were caught **only** by
   the unit test file, never by the pipeline test whose comment claimed to run the real thing. Coverage can
   still be adequate two-layer, but say which layer detects and flag the misleading comment; a twin drifts
   silently. Related to form 3.
9. **The provisional-write window** — when a pipeline persists an optimistic column value *before* the call
   that would justify it and corrects it after, ask three separate questions: (a) is the row observable in
   the provisional state (check the renderer's own condition, e.g. a chip gated on `!failed`, which does
   **not** exclude `pending`), (b) does a **process kill** — not just a thrown error, which the `catch`
   handles — strand it permanently, and (c) is the *correction* mutation-detected. On #299, (a) and (b) were
   real residuals and (c) survived: deleting the accompanying performance-block recompute left the suite at
   960/960 while `analysis_mode` and `perf_bucket_key` would disagree. Standard fix direction to recommend:
   **persist the conservative value and upgrade on evidence**, which costs the same and makes the unearned
   claim structurally impossible.

   **Then review the fix for its own second-order cost.** On #299 round 3 the inversion landed correctly
   (verified by 4 mutations, incl. one the author didn't anticipate: re-adding the pre-call
   `analysisMode = "full_video"` killed 3 tests), but it forced `computePerformanceBlock` to run **twice**,
   which silently broke the ticket-#143 invariant spelled out in `parser/analysis.ts`'s own doc comment —
   "the block the prose guard checks against is the SAME one the prompt was built from." The prompt now
   uses the provisional block and `parseContentAnalysis` the upgraded one; their `bucketKey`s differ, so
   `prose/guard.ts`'s `NumeralFabricationError` can reject a numeral Gemini copied straight out of the
   prompt. **General rule: whenever a provisional/upgrade split introduces a second computation of a value
   that some downstream guard assumes is identity-shared with an upstream consumer, trace every consumer of
   the reassigned variable across the `await` that separates them.** Grep the variable's post-reassignment
   uses; a `let` that was a `const` before the PR is the tell.

   **Resolved on #299 round 4 (accepted).** The fix is to pin the upstream value into a second `const`
   (`promptBlock = computedBlock`) at consumption time and hand *that* to the downstream guard, leaving
   the `let` free to be upgraded for the DB write alone. Two checks settle the verdict: (a) grep every
   post-reassignment use of the `let` and confirm it reaches nothing but the write; (b) run **two**
   mutations, not one — revert the pin (must kill the new test, and only it), *and* disable the upgrade
   branch entirely (`if (false && ...)`), which must trip the test's own "did the upgrade actually fire"
   pre-assertion. Without (b) the pin test passes vacuously the moment the upgrade stops firing, because
   only one block would then exist and the `:metadata_only` match becomes trivial. Residual nit worth
   raising every time: the pin is *positional* (captured on the line after the consumer) unless it is
   declared before the consumer and passed into it.

10. **Indistinguishable sibling columns in the seed helper** — a fixture helper writes the *same* value into
    two columns that the code must choose between, so swapping the column in the implementation is invisible.
    On PR #314 the reaper's `WHERE updated_at < datetime('now','-30 minutes')` mutated to `created_at`
    survived **10/10** tests, because `seedAnalysis` set `created_at` and `updated_at` from one `-N minutes`
    argument. It was a live hazard, not a dead expression: the re-analysis path resets `status='pending'` and
    `updated_at` but leaves `created_at` at original creation, so the mutant reaps a healthy re-analysis of an
    old row on the next boot. **Whenever a predicate names one of several near-twin columns
    (`created_at`/`updated_at`, `computed_at`/`updated_at`), check whether any fixture ever gives them
    different values.** Fix to recommend: split the helper's age argument in two, add one test named for the
    real-world case that separates them.

**Vitest isolation: `vi.doMock` leaks past `vi.resetModules()`, and "move it last" is not a fix.**
`resetModules` clears the resolved-module cache, not the mock registry, so a `doMock` inside one test poisons
every test *declared after it* in the file. Developers "fix" this by ordering. **Probe in one call:** append a
byte-identical copy of an already-passing test after the offending one in a throwaway worktree and run the
file. On #314 the copy failed (`expected "vi.fn()" to be called 1 times, but got 0 times`) while the original
passed — proof the leak is hidden, not fixed. Also: **a claimed "moved the test to the end" is falsified for
free by `deletions: 0` in `gh pr view --json files`** — a move always produces deletions.

**Escalation pattern seen on #234:** each round's fix was real but only closed the level it was aimed at —
round 1 pinned the *values*, round 2 pinned them *exactly*, round 3 had to pin the *set*. When a copy
guard is tightened, immediately ask what the next level up is: value → exact string → element set →
element order.

**Useful discriminator:** `expect(el.textContent).toBe(...)` is byte equality — no trim, no normalisation —
so character-level mutations (NBSP, curly apostrophe, en/em dash swap, trailing space) are all killed by
construction; do not spend calls enumerating them. `getByRole(..., { name })` is a full-string match but on
the **normalised** accessible name (whitespace collapsed and trimmed), so it is exact against wording, not
against whitespace.

10. **The new helper that is only ever mocked** — a PR adds a small helper (a `SELECT`, a predicate) and
    the route test that "covers" it does `vi.mock("@/lib/server/db", () => ({ theHelper: mock }))`. The
    route's *reaction to a boolean* is proven; the helper's own body is executed by no test. Gut the helper
    to a constant and the suite stays green. On #315 `analysisExists` — the sole producer of the ticket's
    404 and of its whole zero-spend guarantee — survived being rewritten to `return true` with 1077/1077
    passing. **Routine check on any PR that adds an exported helper: `grep -rn <helperName> tests/`; if every
    hit is inside a `vi.mock` factory, mutate the helper body.** Fix direction is cheap and should be named
    explicitly: the repo usually already has a real-DB harness (`:memory:` + `runMigrations`) in a sibling
    test file to copy. Severity is test-quality, not correctness — say so — but it is P1 when the undefended
    helper *is* the fix.

11. **The N±1 boundary test that pins magnitude, not the operator** — a test named "boundary: 29 stays,
    31 is reaped (strict `<`)" straddles the threshold, so it pins *where* the threshold is but cannot
    distinguish `<` from `<=`; only a value landing exactly on it can. On #314 round 2 the `<` → `<=`
    mutant survived 12/12 with that test present. **Whenever a boundary test's name claims a comparison
    operator, run the `<`/`<=` (or `>`/`>=`) mutation — it usually survives.** Severity is almost always
    P3 *naming*, not coverage: here the two operators differ only for a row whose `updated_at` is exactly
    the threshold second, and an exact-boundary test would be flaky because SQLite `datetime()` is
    second-granular (seed and sweep may share a second). Recommend deleting the operator claim from the
    test name, not adding a flaky test. Related to form 2 — a name that promises more than the fixture
    can discriminate.

**The `vi.doMock` leak: the fix is a separate FILE, and `vi.doUnmock` is a trap.** Recorded because it was
suggested as the fix on #314 and is wrong — I reproduced the failure myself. `vi.doUnmock(mod)` in an
`afterEach` strips the *file's own hoisted `vi.mock(mod)`* along with the `doMock` override, so the next
test imports the REAL module and its spy is never called (`expected "vi.fn()" to be called 1 times, but got
0 times` — the same symptom as the leak, for the opposite reason). Nested `describe` + `afterEach` does not
help. The only thing that contains a `doMock` is Vitest's default `isolate: true`, i.e. **moving the test
into its own file**. When reviewing that fix, check two things by execution: (a) append a byte-identical
copy of a passing test to the *vacated* file and confirm it now passes, and (b) mutate the production code
the moved test guards (on #314: hoist the dynamic `import` out of its `try`) and confirm the moved test is
still its sole detector — a test can be silently weakened in transit.

## 2. Mocked-SDK boundary tests

Check the **mocked response value** against `.claude/context/verified-facts.md`, not just the assertion.
A test can exercise a shape the real service never produces and still pass.

PR #245's "empty text" test fed `text: ""`. `verified-facts.md` records that `@google/genai`'s
`response.text` getter returns **`undefined`** when there are no text parts — so the test covered a case
that cannot occur and skipped the one that does. On the real `undefined` path the code returned the right
answer only by throwing a `TypeError` inside a helper and having an outer `catch` swallow it. Right
result, wrong mechanism, zero coverage.

Pair every mocked response with a mutation: delete the guard the test claims to cover and re-run. If the
suite stays green because some *downstream* path independently produces the same result (a sanitiser that
also returns `null`, a default that also returns `0`), the test pins the contract but not the guard — say
exactly that, and suggest an assertion that separates them (e.g. asserting a log call that only one path
makes).

## 3. The env-gated mutation harness (N mutants in ~3 tool calls)

To mutation-test a validator with many independent clauses, do **not** edit/run/restore once per mutant.
Rewrite the file **once** in a throwaway worktree with every clause wrapped in an env gate:

```ts
const off = (k: string) => process.env[`MUT_${k}`] === "1";
if (!turso) { if (!off("M2")) problems.push(...) }
```

Then run the test file once per `MUT_*` flag and restore the original with a single `Write`. Preserve the
original `if / else if` chain structure — nest the gate *inside* each branch, or you change control flow
and the result is meaningless.

On PR #247 this covered 7 mutants (5 guard clauses + the `NODE_ENV` early return + the error-message
prefix) in 3 tool calls instead of ~15, inside the <=25-call review budget. All 7 were killed, a much
stronger statement than "the tests pass".

Two operational notes learned the hard way in a worktree-isolated session:
- Worktree isolation **rejects** `for` loops and `$(...)` command substitution as "too complex to verify".
  Issue the mutant runs as N plain `cd <worktree> && MUT_X=1 npx vitest run <file>` commands in a single
  parallel tool block instead.
- Symlink `node_modules` from the main checkout into the throwaway worktree rather than `npm ci` — valid
  whenever the PR does not touch `package.json`/`package-lock.json`. Check that first.

## 4. Mutation-prove silent-failure invariants specifically

For invariants that would fail silently (self-exclusion before a median, a "stored value is frozen"
guarantee), break the implementation in the throwaway worktree and confirm the **named** test goes red.
Two edits are usually enough — no-op the exclusion filter, and make the frozen-value early return
conditional. Check *which* tests fail, not just that some do. On PR #263 this took 4 tool calls and
upgraded "green suite" to "guarantee proven". These two failure modes (biased median, thawed frozen
multiplier) produce plausible-looking numbers no user would ever question.

You can sometimes verify a reported mutation proof by **re-deriving it from the fixture arithmetic**
rather than running anything: on #263 the fixture was `sampleSize: 5, minSample: 5`, so the old branch's
`Math.min(5,5)` reproduced the claimed failure output exactly.

## 5. Auditing an anonymisation / fixture-scrub PR

A scrub PR rewrites thousands of values inside single-line JSON blobs, so `git diff` is useless. Two
throwaway Node scripts in `/tmp` settle it in ~3 tool calls. Extract `main` with
`git archive main | tar -x -C /tmp/<dir>` (do **not** add a second worktree for `main` — it is already
checked out and git refuses).

1. **Skeleton diff** — walk both JSON trees emitting `path:typeof` (arrays collapsed to `[]`), set-diff
   the two. Answers "did payload shape survive" definitively. On #269 all 9 fixtures came back
   `SHAPE-IDENTICAL`.
2. **Leaf value diff** — flatten to `path -> scalar`, report every change grouped by leaf key name, and
   count how many changed values were `number`. **Zero numeric changes** is the machine proof that
   "metric fields untouched" is true. It also yields the distinct-replacement-username count for free,
   so you can check the developer's arithmetic without trusting it.

What the scripts do *not* catch, and you must grep for separately — on #269 each of these was a real
finding the ticket's own inventory had missed:
- Real identifiers the scrubber's key list didn't cover. **`shortcode` is the big one**: scrub the
  caption, the CDN URLs and the username, leave the shortcode, and `instagram.com/p/<shortcode>` restores
  all of it in one click.
- Handles/IDs living in `lib/`, `migrations/` and *comments* rather than fixtures. Grep the whole tree,
  including files the PR already touched — #269 changed a comment in `service.test.ts` and left a real
  handle 200 lines below it.
- **Shape fidelity that is type-correct but wrong**: synthetic IDs whose digit *length* doesn't match the
  source (10-digit IG user id → 17 digits), and every caption/comment collapsed to one identical ASCII
  string, destroying the fixtures' only multi-line and non-ASCII coverage. Types match, so nothing fails —
  the fixture just silently teaches future code the wrong shape.
- **Doc edits that assert a scrub that did not happen.** Diff the authority doc's *claims* against your
  value diff. On #269 `verified-facts.md` was edited to say metric figures were "scrubbed from the
  fixture", contradicting both the value diff and the PR body.

**A raw-string grep is not a leak scan — decode every opaque field before accepting "0 leaks."**
#269 round 3: the developer scrubbed all 82 media ids and derived new shortcodes from them (the right
fix), but left `tracking_token` untouched as "out of scope". It is base64 of
`{"version":5,"payload":{"is_analytics_tracked":true,"uuid":"<32 hex><REAL MEDIA ID>"},"signature":""}`.
All 35 tokens decoded to a real id; 34 distinct ids recovered; all 34 re-encoded to a real shortcode →
a live public post URL. That is **41% of the scrub undone by a sibling field in the same JSON node**, and
invisible to every grep the developer ran. **Method:** walk every fixture, base64-decode any
opaque/token/blob-looking string leaf, and search the *decoded* text for the pre-scrub needle set pulled
from the base ref. Also settle scrub cost with `grep -rE "<field>" lib app tests --include=*.ts` — a
field with **zero runtime references** (`tracking_token`, `fbid`) can be rewritten at zero test risk, which
collapses the "scope expansion" defence; one that is read (`audio_id` → `adapter.ts` → persisted) needs a
lockstep test update and is a legitimately bigger ask.
Grade recoverability by class: **local decode** (blocking) > **external lookup** (`audio_id` +
`song_name: "Original audio"` resolves to the creator's audio page — document, don't block) > **already
deliberately exempt** (NASA's `fbid` — no action). Watch for a node carrying *mixed* real and synthetic
identity (NASA: synthetic `username`/`id`, real `fbid`/`biography`) — nobody downstream can tell which is
which, so the exemption must name the surviving fields.

**"0 numeric-value diffs" proves nothing about ids in these fixtures**: `id` (563), `shortcode` (130) and
`tracking_token` (35) are all **JSON string**-typed on `main`, so an id scrub cannot move a numeric leaf
by construction. Census the leaf types before treating a preserved numeric-diff count as either
reassuring or suspicious.

For the rebuilt arithmetic, re-derive it in `node -e` rather than reading the comments: confirm the
stored quotient is byte-identical (`q === literal`), that the live-recomputed value is genuinely far from
it, and — the step that catches a dead test — that the *un*-excluded / *un*-frozen variant would actually
fail the assertion as written. On #269: excluding self gave `82.667` (passes `toBeCloseTo(82.7,1)`),
including self gave `78.481` (fails). That is what makes it a detector rather than a tautology.

## 6. Proving a "pure refactor" has zero semantic effect

When a PR de-duplicates a constant, extracts a helper, or otherwise claims "no behaviour change" on an
artifact that a *third party* is constrained by (a Gemini `responseSchema`, a JSON contract, a migration),
never accept the reasoning — **emit the artifact from both refs and `cmp` it**. Three tool calls:

1. In a throwaway worktree at the PR head, add a scratch vitest file that imports the module and
   `writeFileSync(process.env.DUMP_OUT, JSON.stringify(allExports, null, 2))`. Run it.
2. `git checkout <base-ref> -- <the one changed file>` **inside the same worktree**, re-run with a
   different `DUMP_OUT`. No second worktree needed.
3. `cmp` / `md5` the two dumps. Restore with `git checkout <head-sha> -- <file>`, delete the scratch test,
   confirm `git status --porcelain` is empty.

`JSON.stringify` preserves insertion order, so this pins **key order as well as content** in one shot.
That matters more than it looks: on PR #298 `scorecardSchema` carried an explicit
`propertyOrdering: [...SCORECARD_KEYS]`, so a reordered source array would have been a real model-facing
change that a set-comparison would have missed. Result there was byte-identical (same md5, whole module),
which settled an owner-ruling question ("no schema change") that no amount of diff-reading could.

Pair it with two cheap secondary checks the dump does **not** cover: **import cycles** (grep the newly
imported module for a reference back) and **new runtime side effects** pulled into the importing layer.

## 7. Verifying the *fix* for form 10 (the `vi.mock`-only helper)

When a developer closes a "no test ever executes this helper" finding by adding a real-DB test, the
always-true mutant dying is **necessary but not sufficient** — an always-true mutant is killed by any test
that expects `false` once, including one run against an empty table, which proves nothing about
id-discrimination. Always run the two subtler siblings before signing off:

- **Predicate dropped** — `SELECT 1 FROM analyses LIMIT 1` with the *honest* `rows.length > 0`
  ("is the table non-empty?"). Only a test that queries a phantom id **while the table holds another row**
  kills this.
- **Predicate inverted** — `WHERE id != ?`. Keeps the `args` binding, so it survives any test that merely
  asserts "the argument was passed"; needs a positive `true`-for-a-real-row case to die.

Kill conditions therefore require three cases, not two: phantom-on-empty, real-id-true, and
phantom-while-non-empty. `LIMIT 1` removal is an **equivalent** mutant — do not file it as a gap (§0).
Verified on PR #315 round 2 (#312): all three mutants died, so I cleared it.

Related: [[review-conduct]], [[review-worktree-and-gates]], [[project-3c-analyses-table]],
[[differential-build-proof]].
