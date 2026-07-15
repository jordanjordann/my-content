export const PIN_HASH_KEY = "pin_hash";
export const PIN_SET_AT_KEY = "pin_set_at";
export const AUTH_COOKIE_NAME = "my_content_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export const authCookieOptions = {
  httpOnly: true,
  maxAge: SESSION_TTL_SECONDS,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
