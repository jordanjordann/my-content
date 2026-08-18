import { describe, expect, it } from "vitest";

import { assertProductionEnv } from "@/lib/server/env/productionEnv";

/**
 * #244. `assertProductionEnv` takes an explicit `env` param (defaulting to
 * `process.env`) so these tests never mutate the real process environment.
 */

const VALID_PROD_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  TURSO_DATABASE_URL: "libsql://my-content-prod.turso.io",
  TURSO_AUTH_TOKEN: "a-real-token",
  APP_SESSION_SECRET: "a-real-session-secret",
};

describe("assertProductionEnv", () => {
  it("is a no-op outside production", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertProductionEnv({ NODE_ENV: "test" })).not.toThrow();
  });

  it("passes in production when every required var is present and valid", () => {
    expect(() => assertProductionEnv({ ...VALID_PROD_ENV })).not.toThrow();
  });

  it("throws when TURSO_DATABASE_URL is unset", () => {
    const env = { ...VALID_PROD_ENV, TURSO_DATABASE_URL: undefined };
    expect(() => assertProductionEnv(env)).toThrow(/TURSO_DATABASE_URL/);
  });

  it("throws when TURSO_DATABASE_URL is empty string", () => {
    const env = { ...VALID_PROD_ENV, TURSO_DATABASE_URL: "" };
    expect(() => assertProductionEnv(env)).toThrow(/TURSO_DATABASE_URL/);
  });

  it("throws when TURSO_DATABASE_URL is an explicit file: URL", () => {
    const env = { ...VALID_PROD_ENV, TURSO_DATABASE_URL: "file:./my-content.db" };
    expect(() => assertProductionEnv(env)).toThrow(/TURSO_DATABASE_URL/);
  });

  it("throws when TURSO_AUTH_TOKEN is unset for a libsql:// URL", () => {
    const env = { ...VALID_PROD_ENV, TURSO_AUTH_TOKEN: undefined };
    expect(() => assertProductionEnv(env)).toThrow(/TURSO_AUTH_TOKEN/);
  });

  it("throws when TURSO_AUTH_TOKEN is unset for an https:// URL", () => {
    const env = {
      ...VALID_PROD_ENV,
      TURSO_DATABASE_URL: "https://my-content-prod.turso.io",
      TURSO_AUTH_TOKEN: undefined,
    };
    expect(() => assertProductionEnv(env)).toThrow(/TURSO_AUTH_TOKEN/);
  });

  it("throws when APP_SESSION_SECRET is unset", () => {
    const env = { ...VALID_PROD_ENV, APP_SESSION_SECRET: undefined };
    expect(() => assertProductionEnv(env)).toThrow(/APP_SESSION_SECRET/);
  });

  it("throws when RESET_PIN is the literal string 'true'", () => {
    const env = { ...VALID_PROD_ENV, RESET_PIN: "true" };
    expect(() => assertProductionEnv(env)).toThrow(/RESET_PIN/);
  });

  it("does not throw when RESET_PIN is any other value", () => {
    const env = { ...VALID_PROD_ENV, RESET_PIN: "false" };
    expect(() => assertProductionEnv(env)).not.toThrow();
    expect(() => assertProductionEnv({ ...VALID_PROD_ENV, RESET_PIN: "your-reset-pin" })).not.toThrow();
  });

  it("reports two missing vars in a single error naming both", () => {
    const env = {
      ...VALID_PROD_ENV,
      TURSO_DATABASE_URL: undefined,
      APP_SESSION_SECRET: undefined,
    };

    let caught: unknown;
    try {
      assertProductionEnv(env);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toMatch(/^Invalid production environment:/);
    expect(message).toMatch(/TURSO_DATABASE_URL/);
    expect(message).toMatch(/APP_SESSION_SECRET/);
  });
});
