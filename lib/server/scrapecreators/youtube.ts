import { SC_PATHS } from "@/lib/server/scrapecreators/constants";
import { scRequest } from "@/lib/server/scrapecreators/client";
import type {
  ScrapeCreatorsYoutubeChannel,
  ScrapeCreatorsYoutubeVideo,
} from "@/lib/server/scrapecreators/types";

/**
 * `trim` is deliberately NOT passed on either YouTube endpoint. Live testing
 * (2026-07-21) against both `/v1/youtube/video` and `/v1/youtube/channel`
 * found `trim=true` has no observed effect — identical top-level key sets
 * with and without it, unlike `/v1/instagram/post` where `trim=true`
 * silently strips the `data` envelope and drops fields (see PR #42 and
 * lib/server/scrapecreators/instagram.ts). Omitting the param keeps the
 * request minimal without any known downside. See
 * .claude/context/verified-facts.md for the full comparison.
 */

/**
 * Fetch the raw `/v1/youtube/video` payload. No mapping happens here — this
 * endpoint is flat with no `data` envelope (confirmed live, see
 * verified-facts.md), and translating it into MediaMetadata is the
 * fetcher's job (ticket #54, lib/server/analysis/fetcher/youtube.ts).
 *
 * A deleted/unavailable video resolves to a genuine HTTP 404
 * (`{ success: false, error: "not_found", ... }`), which `scRequest`
 * already turns into a thrown `ScrapeCreatorsError` before this function
 * returns — callers never see a hollow/empty video object.
 */
export async function getYoutubeVideo(url: string): Promise<ScrapeCreatorsYoutubeVideo> {
  return scRequest<ScrapeCreatorsYoutubeVideo>(SC_PATHS.youtubeVideo, { url });
}

/**
 * Fetch the raw `/v1/youtube/channel` payload by handle. No mapping happens
 * here — same flat-envelope module boundary as `getYoutubeVideo` above.
 *
 * The query param is `handle`, not a channel-id param — confirmed live: a
 * bare handle (`hiddentracktv2`) and an `@`-prefixed handle
 * (`@hiddentracktv2`) both resolve identically, but the `UC...` channel id
 * does NOT resolve (it 404s with `accountDoesNotExist: true`). Callers must
 * pass `channel.handle` from a `/v1/youtube/video` response (or an
 * equivalent bare/`@`-prefixed handle string), never `channel.id`.
 *
 * A not-found handle also resolves to a genuine HTTP 404 despite the JSON
 * body itself saying `success: true` — `scRequest` decides success/failure
 * from the HTTP status, not the body, so this is already handled without
 * extra detection logic here. See verified-facts.md for the full capture.
 */
export async function getYoutubeChannel(handle: string): Promise<ScrapeCreatorsYoutubeChannel> {
  return scRequest<ScrapeCreatorsYoutubeChannel>(SC_PATHS.youtubeChannel, { handle });
}
