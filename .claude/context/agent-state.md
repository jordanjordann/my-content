# Agent state — operational notes

Short, operational, and current. Not a history file. If something here goes stale, fix it in place.

## ScrapeCreators credit balance — 31,986, and deliberately not re-measured

- The **last directly observed `credits_remaining` is 31,986, on 2026-08-07.** It was read off a call
  that was **already being made**, not off a call made to check the balance.
- **31,986 still stands as of 2026-08-09.** The 2026-08-07 session was entirely offline / fixture-driven
  — **zero credits spent** — so nothing has moved it since.
- Any analysis run after that lowers it. If work has happened and this line has not been updated, treat
  31,986 as an **upper bound**, not a current figure.
- It is **not** re-measured on purpose: **re-measuring costs real credits.**

**Rule (unchanged, still in force):** if you need the balance, read `credits_remaining` off the response
body of a call you were **already going to make**. Do **not** make a ScrapeCreators call purely to check
the balance.

**Superseded, recorded rather than deleted:** this note previously cited **31,994 (2026-07-22,
`docs/RUNBOOK.md` §5)** as the last measurement. That is a **historical data point** and must not be
quoted as current — 31,986 is the later and more accurate reading.
