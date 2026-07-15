import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

import { deleteSettings, getSetting, setSetting } from "@/lib/server/db";
import { PIN_HASH_KEY, PIN_SET_AT_KEY, AUTH_COOKIE_NAME, SESSION_TTL_SECONDS } from "./constants";
import type { SessionPayload } from "./types";

export function validatePin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

export async function hasPinConfigured() {
  await resetPinIfRequested();
  return Boolean(await getSetting(PIN_HASH_KEY));
}

export async function setupPin(pin: string) {
  if (!validatePin(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }

  if (await hasPinConfigured()) {
    throw new Error("PIN is already configured.");
  }

  const hash = await bcrypt.hash(pin, 12);
  await setSetting(PIN_HASH_KEY, hash);
  await setSetting(PIN_SET_AT_KEY, new Date().toISOString());
}

export async function verifyPin(pin: string) {
  if (!validatePin(pin)) {
    return false;
  }

  const hash = await getSetting(PIN_HASH_KEY);
  if (!hash) {
    return false;
  }

  return bcrypt.compare(pin, hash);
}

export function createSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function verifySessionToken(token: string | undefined) {
  if (!token) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = sign(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function resetPinIfRequested() {
  if (process.env.RESET_PIN === "true") {
    await deleteSettings([PIN_HASH_KEY, PIN_SET_AT_KEY]);
  }
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function getSessionSecret() {
  const secret = process.env.APP_SESSION_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_SESSION_SECRET is required in production.");
  }

  return "dev-only-my-content-session-secret";
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
