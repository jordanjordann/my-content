import type {
  AnalysesListResponse,
  AnalysisDetail,
  AnalyzeResponse,
  DeleteResponse,
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

export async function getAnalyses(): Promise<AnalysesListResponse> {
  return fetchJson<AnalysesListResponse>("/api/analyses");
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
