import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Loader for the committed **real** API captures.
 *
 * Single source of truth is `.claude/context/fixtures/` — the directory the
 * RUNBOOK (§6) and `docs/HANDOFF-2026-07-22.md` already point every agent at.
 * Tests read from there rather than keeping a second copy under `tests/`,
 * because two copies of a capture is two things that can drift, and the
 * agent-facing docs would still send readers to the `.claude` copy.
 *
 * Nothing in this module may hit the network. ScrapeCreators is credit-based
 * (`/v1/youtube/channel` charges a credit even on a not-found), so the test
 * suite is offline by construction — see `tests/fixtures/README.md`.
 */

const FIXTURES_ROOT = fileURLToPath(new URL("../../.claude/context/fixtures/", import.meta.url));

/** Relative path under `.claude/context/fixtures/`, e.g. `scrapecreators-youtube/yt_video_fresh.json`. */
export function loadJsonFixture<T>(relativePath: string): T {
  const absolutePath = join(FIXTURES_ROOT, relativePath);

  if (!existsSync(absolutePath)) {
    throw new Error(
      `[tests] Missing fixture "${relativePath}" — expected a committed capture at ` +
        `"${absolutePath}". These are real, credit-charged API captures; do not delete or rename ` +
        "them (see .claude/context/fixtures/README.md). If this is intentional (a fixture set was " +
        "moved or renamed), update the path constants in tests/helpers/fixtures.ts to match.",
    );
  }

  return JSON.parse(readFileSync(absolutePath, "utf8")) as T;
}

export const YOUTUBE_FIXTURES = {
  videoFresh: "scrapecreators-youtube/yt_video_fresh.json",
  videoTrim: "scrapecreators-youtube/yt_video_trim.json",
  videoDeleted: "scrapecreators-youtube/yt_video_deleted.json",
  short: "scrapecreators-youtube/yt_short.json",
  channelHandle: "scrapecreators-youtube/yt_channel_handle.json",
  channelAtHandle: "scrapecreators-youtube/yt_channel_athandle.json",
  channelTrim: "scrapecreators-youtube/yt_channel_trim.json",
  channelUcid: "scrapecreators-youtube/yt_channel_ucid.json",
  channelUcid2: "scrapecreators-youtube/yt_channel_ucid2.json",
  channelBogus: "scrapecreators-youtube/yt_channel_bogus.json",
} as const;
