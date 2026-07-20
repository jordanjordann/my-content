const DEFAULT_PROFILE_TTL_DAYS = 7;

function resolveProfileTtlDays(): number {
  const raw = process.env.PROFILE_TTL_DAYS;
  if (raw === undefined || raw === "") {
    return DEFAULT_PROFILE_TTL_DAYS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid PROFILE_TTL_DAYS env var: "${raw}" is not a positive finite number. ` +
        `Unset it to use the default (${DEFAULT_PROFILE_TTL_DAYS} days) or provide a valid positive integer.`,
    );
  }

  return parsed;
}

export const PROFILE_TTL_DAYS = resolveProfileTtlDays();
