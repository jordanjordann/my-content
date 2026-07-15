export type SessionPayload = {
  iat: number;
  exp: number;
};

export type AuthCookieOptions = {
  httpOnly: boolean;
  maxAge: number;
  path: string;
  sameSite: "lax";
  secure: boolean;
};
