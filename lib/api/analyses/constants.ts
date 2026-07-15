export const ANALYSIS_KEYS = {
  all: ["analyses"] as const,
  lists: () => [...ANALYSIS_KEYS.all, "list"] as const,
  detail: (id: string) => [...ANALYSIS_KEYS.all, "detail", id] as const,
};
