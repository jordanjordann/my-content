import type {
  AnalysesListResponse,
  AnalysisDetail,
  AnalyzeResponse,
  DeleteResponse,
  GetAnalysesParams,
} from "./types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) {
    const error = new Error((data as { error?: string }).error ?? response.statusText);
    (error as Error & { status: number }).status = response.status;
    throw error;
  }
  return data as T;
}

/**
 * AGENTS.md layering: returns the payload AS-IS, no transformation. Ticket
 * #144's pagination params are forwarded verbatim as query params;
 * `lib/api/analyses/hooks.ts`'s `select` is the only place the response is
 * ever reshaped. Sorting was removed by owner ruling (#266, 2026-08-20) —
 * there is no `sortBy`/`sortDir` param to forward anymore.
 */
export async function getAnalyses(params: GetAnalysesParams = {}): Promise<AnalysesListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page != null) searchParams.set("page", String(params.page));
  if (params.pageSize != null) searchParams.set("pageSize", String(params.pageSize));

  const query = searchParams.toString();
  return fetchJson<AnalysesListResponse>(`/api/analyses${query ? `?${query}` : ""}`);
}

export async function getAnalysis(id: string): Promise<AnalysisDetail> {
  return fetchJson<AnalysisDetail>(`/api/analyses/${id}`);
}

export async function analyzeContent(
  urls: string[],
  prompt: string,
): Promise<AnalyzeResponse> {
  return fetchJson<AnalyzeResponse>("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls, prompt }),
  });
}

export async function deleteAnalysis(id: string): Promise<DeleteResponse> {
  return fetchJson<DeleteResponse>(`/api/analyses?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
