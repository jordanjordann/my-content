# Agent state — operational notes

Short, operational, and current. Not a history file. If something here goes stale, fix it in place.

## ScrapeCreators credit balance — UNKNOWN, and deliberately not re-measured

- The **last actual measurement was 31,994 credits remaining on 2026-07-22** (`docs/RUNBOOK.md` §5).
- Analyses have run since. The true balance is **lower by an unknown amount**.
- It has **not** been re-measured on purpose: **re-measuring costs real credits.**

**Rule:** if you need the balance, read `credits_remaining` off the response body of a call you were
**already going to make**. Do **not** make a ScrapeCreators call purely to check the balance.

Do not quote 31,994 as a current figure anywhere. It is a historical data point.
