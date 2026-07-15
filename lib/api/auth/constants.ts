export const AUTH_KEYS = {
  all: ["auth"] as const,
  status: () => [...AUTH_KEYS.all, "status"] as const,
};
