import {
  ApiError,
  GoogleGenAI,
  FinishReason,
  MediaModality,
  type Part,
  type GenerateContentResponseUsageMetadata,
} from "@google/genai";

import { ANALYSIS_RESPONSE_SCHEMA } from "@/lib/server/analysis/schema";
import type { PreparedGeminiPart } from "@/lib/server/analysis/media";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

// Ticket #295: default `videoMetadata.fps` sampling is 1.0 (SDK-documented,
// verified live). A clip under ~2s can round to zero sampled frames and
// Gemini returns HTTP 400 "No frames to extract with given parameters" —
// this is NOT an access/availability failure, the video was already
// fetched. Retried exactly once, only for this specific error, with fps
// raised. Do NOT raise this globally: it directly multiplies input token
// cost (a 1s clip billed ~6049 VIDEO tokens at fps 24 vs. a normal ~300
// tokens/sec at the default rate — see verified-facts.md).
const FRAME_SAMPLING_RETRY_FPS = 24;
const NO_FRAMES_ERROR_PATTERN = /No frames to extract/i;

function isFrameSamplingError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400 && NO_FRAMES_ERROR_PATTERN.test(error.message);
}

/**
 * Ticket #295 code review, B2: the ONLY mechanical proof that Gemini actually
 * decoded a video, rather than answering off title/description text alone,
 * is `usageMetadata.promptTokensDetails` carrying a `VIDEO`-modality entry
 * with a positive token count — the exact signal
 * `docs/audit/ANALYSIS-288-youtube-extraction.md` §3's spike used to prove
 * "option 3 works" (real capture: `{"modality":"VIDEO","tokenCount":6049}`
 * alongside a fabrication test that only passed because the model had really
 * seen the frames). `usageMetadata` is a plain, all-optional class
 * (`GenerateContentResponseUsageMetadata`, `genai.d.ts`) — every field,
 * including `promptTokensDetails` and each entry's `modality`/`tokenCount`,
 * can be absent, so this reads defensively rather than asserting shape.
 * Do NOT infer video modality from `mimeType`, part shape, or any
 * pre-call assumption — this is the only post-call, response-derived check.
 */
export function hasVideoModalityEvidence(usageMetadata: GenerateContentResponseUsageMetadata | undefined): boolean {
  return (usageMetadata?.promptTokensDetails ?? []).some(
    (detail) => detail.modality === MediaModality.VIDEO && (detail.tokenCount ?? 0) > 0,
  );
}

/**
 * Ticket #295, M1 (code review): only a bare `fileData` part with NO
 * `mimeType` can hit the frame-sampling trap — that shape is
 * `YoutubeNativeUrlPart`, a genuine discriminated variant of
 * `PreparedGeminiPart` (`media/types.ts`), not merely a convention on a
 * single widened type. `UploadedVideoPart` (Instagram, File API upload)
 * REQUIRES `mimeType: string`; `InlineImagePart` has no `fileData` key at
 * all — this guard therefore cannot fire on either, enforced by the type
 * checker at the point every part is constructed, not just by
 * platform-checking here.
 */
function isBareYoutubeUrlPart(
  part: PreparedGeminiPart,
): part is Extract<PreparedGeminiPart, { fileData: { fileUri: string; mimeType?: undefined } }> {
  return "fileData" in part && part.fileData.mimeType === undefined && part.videoMetadata === undefined;
}

function withFrameSamplingRetry(parts: PreparedGeminiPart[]): PreparedGeminiPart[] | null {
  let changed = false;
  const retried = parts.map((part) => {
    if (isBareYoutubeUrlPart(part)) {
      changed = true;
      return { ...part, videoMetadata: { fps: FRAME_SAMPLING_RETRY_FPS } };
    }
    return part;
  });
  return changed ? retried : null;
}

/**
 * Ticket #71 Step 4: `analyzeContent(fileUri, prompt)` -> `analyzeContent(parts,
 * prompt)`. Media parts (videos via the File API, images inline as base64)
 * precede the text prompt, in slide order — a carousel's N media parts all
 * go to Gemini in ONE call, not one call per slide.
 */
export interface AnalyzeContentResult {
  text: string;
  raw: string;
  /**
   * Raw `usageMetadata` off the Gemini response — surfaced (not discarded)
   * per ticket #295 code review B2, so a caller can prove video modality was
   * actually decoded rather than trusting a pre-call assumption. `undefined`
   * only in the already-guarded-against case where the SDK omits it (the
   * `finishReason` check above already fails closed before this is reached
   * in every real success path).
   */
  usageMetadata: GenerateContentResponseUsageMetadata | undefined;
}

export async function analyzeContent(
  mediaParts: PreparedGeminiPart[],
  prompt: string,
): Promise<AnalyzeContentResult> {
  try {
    return await callGemini(mediaParts, prompt);
  } catch (error) {
    if (!isFrameSamplingError(error)) {
      throw error;
    }
    const retriedParts = withFrameSamplingRetry(mediaParts);
    if (retriedParts === null) {
      // No bare fileData part to retry with a higher fps — this 400 came
      // from somewhere else (e.g. a File-API-uploaded video, which is
      // unexpected). Do not mask it as recoverable.
      throw error;
    }
    console.warn(
      "[GEMINI] Frame-sampling floor hit (short clip, default 1.0 fps) — retrying once with videoMetadata.fps raised. This retry costs more input tokens than the default rate.",
    );
    return await callGemini(retriedParts, prompt);
  }
}

async function callGemini(mediaParts: PreparedGeminiPart[], prompt: string): Promise<AnalyzeContentResult> {
  const parts: Part[] = [...mediaParts];

  parts.push({ text: prompt });

  console.log("[GEMINI] Prompt sent:");
  console.log(prompt);

  // TDD §4.2 / PRD §5.1, §5.2: temperature 0 for reproducibility, structured
  // JSON output constrained by ANALYSIS_RESPONSE_SCHEMA (no fence, no prose
  // wrapper), and a raised token budget — thinking tokens are billed out of
  // the same maxOutputTokens budget on gemini-2.5-flash, so a short budget
  // risks MAX_TOKENS truncation before the model finishes "thinking" and
  // starts emitting the JSON body. This has truncated real Gemini calls
  // before; see .claude/context/verified-facts.md for the SDK mechanics
  // (usageMetadata.thoughtsTokenCount is billed against maxOutputTokens).
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: parts,
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_RESPONSE_SCHEMA,
      maxOutputTokens: 32768,
    },
  });

  // Log on every call, success or failure, so real headroom against the
  // 32768 budget (candidatesTokenCount + thoughtsTokenCount) is measurable
  // rather than guessed at (TDD §4.2, ticket #66).
  console.log("[GEMINI] usageMetadata:", JSON.stringify(response.usageMetadata));

  // gemini-2.5-flash spends thinking tokens out of the same `maxOutputTokens`
  // budget, so a run can stop at MAX_TOKENS with a truncated body. Truncated
  // output is not salvageable — throw here, BEFORE any caller (or this
  // function) attempts to parse the body. This is the PRD §5.4 "loud errors,
  // not invented data" rule applied at the generation boundary.
  //
  // Fail CLOSED: an absent finishReason (missing/empty `candidates`, or an
  // SDK response shape that doesn't populate it) must NOT fall through to
  // parsing. Only an explicit `FinishReason.STOP` passes the guard — every
  // other value, including `undefined`, is a hard error (code review on
  // ticket #66).
  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason !== FinishReason.STOP) {
    throw new Error(
      `Gemini generation did not complete: finishReason=${finishReason ?? "undefined"}`,
    );
  }

  // `text` is a getter on @google/genai (it was a method on the legacy SDK).
  // A missing `()` would silently stringify a function reference, so assert the
  // type at the boundary instead of trusting it.
  const text = response.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Gemini returned no text content");
  }

  console.log("[GEMINI] Response received:");
  console.log(text);

  return { text, raw: text, usageMetadata: response.usageMetadata };
}
