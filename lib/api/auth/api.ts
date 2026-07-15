import type { AuthStatus } from "./types";

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

export async function getAuthStatus(): Promise<AuthStatus> {
  return fetchJson<AuthStatus>("/api/auth/status");
}

export async function submitPin(pin: string, pinConfigured: boolean): Promise<{ ok: boolean }> {
  const endpoint = pinConfigured ? "/api/auth/verify" : "/api/auth/setup";
  return fetchJson<{ ok: boolean }>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
}

export type { AuthStatus } from "./types";
