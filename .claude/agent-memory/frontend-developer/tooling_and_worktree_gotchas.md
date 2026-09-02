# Tooling, worktree and workflow gotchas (FE)

## Worktree paths — silent wrong reads

**Historical note:** agents used to run in a git worktree at `.claude/worktrees/<id>`. As of 2026-08-20
`worktree.bgIsolation` is `"none"` and agents run in the **main checkout**, so most of this no longer
applies day to day — but it still applies to any *throwaway* worktree you create yourself.

When working in a worktree, `Read` / `Edit` / `Write` / `Bash` all need the **worktree's** absolute path,
not the main checkout path. **Reading from the main checkout path silently returns stale/wrong content (a
different branch) with no error** — easy to misdiagnose as "my edit didn't apply". Always check that
`pwd` / `git branch --show-current` matches the path prefix you are reading.

## `tsc` / `npx` in a throwaway worktree outside the repo tree

`npx tsc` relies on Node's `node_modules` resolution walking up the directory tree. A worktree created at a
path **outside** the original repo tree (e.g. `/tmp/foo`) won't find `node_modules` even via a plain
symlink named `node_modules` — `npx` still prints "This is not the tsc command you are looking for".

**Fix:** symlink `node_modules` to the **real resolved path** (not through another symlink chain) and
invoke `node_modules/.bin/tsc` **directly** instead of `npx tsc`.

## Branch collisions between agents

Another worktree may already hold the target branch name locally, which makes `git checkout -B <branch>`
fail hard. Create a differently-named local branch tracking the remote
(`git checkout -B fe-work-252 origin/<branch>`), then push with an explicit refspec
(`git push origin fe-work-252:<branch>`). **Do not touch the other worktree.**

## Mutation-proof workflow that works

`cp file /tmp/backup` → edit in place to the "wrong" old behaviour → run the specific test file → confirm
failure with the exact expected/received diff → `cp /tmp/backup file` to restore → `git diff --stat` and
`git status --short` to confirm a clean restore before moving on.

(Reviewers must use the **Edit tool** to revert, never `git checkout --`; the `cp` route is fine for a file
you copied out yourself.)

## Surviving a session limit

When resuming another agent's partial work, **commit and push immediately** once a patch applies cleanly,
before continuing. This was explicitly instructed on #252 and worked well — the partial patch
(`lib/api/analyses/helpers.ts`, `types.ts`, `tests/lib/api/analyses/helpers.test.ts`) survived the handoff.

## System reminder vs `AGENTS.md`

A system reminder instructing "use sed/heredocs/shell redirection for edits" directly contradicts this
repo's `AGENTS.md`. **`AGENTS.md` wins — Edit/Write tools only for repo files.** Shell redirection is for
throwaway scratch files under `/tmp` only.
