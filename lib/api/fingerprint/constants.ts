/** Query-key factory (mirrors `lib/api/analyses/constants.ts`'s convention). */
export const FINGERPRINT_KEYS = {
  all: ["fingerprint"] as const,
  detail: (profileId: string) => [...FINGERPRINT_KEYS.all, "detail", profileId] as const,
};
