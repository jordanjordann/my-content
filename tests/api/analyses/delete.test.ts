import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

/**
 * Ticket #312 (#281 audit P2) — docs/TDD-analysis-write-verification.md §4.3:
 * `deleteAnalysis` used to discard `rowsAffected`, so `DELETE
 * /api/analyses?id=…` returned `{ success: true }` even when nothing was
 * removed. Real `:memory:` libsql DB (same technique as
 * `tests/api/analyses/route.test.ts`) so the 0-row case is genuine, not
 * simulated.
 */

const { isAuthenticatedMock } = vi.hoisted(() => ({
  isAuthenticatedMock: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("@/lib/server/auth", () => ({
  isAuthenticated: isAuthenticatedMock,
}));

async function runMigrations(db: Client): Promise<void> {
  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.executeMultiple(readFileSync(join(migrationsDir, file), "utf8"));
  }
}

function makeDeleteRequest(id?: string): Request {
  const url = id ? `http://localhost/api/analyses?id=${id}` : "http://localhost/api/analyses";
  return new Request(url, { method: "DELETE" });
}

let db: Client;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let route: any;

beforeEach(async () => {
  vi.resetModules();
  isAuthenticatedMock.mockReset();
  isAuthenticatedMock.mockResolvedValue(true);
  process.env.TURSO_DATABASE_URL = ":memory:";
  delete process.env.TURSO_AUTH_TOKEN;
  const dbModule = await import("@/lib/server/db");
  db = dbModule.db;
  await runMigrations(db);
  route = await import("@/app/api/analyses/route");
});

afterEach(() => {
  db?.close();
  vi.restoreAllMocks();
});

async function insertAnalysis(id: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO analyses (id, prompt, url, platform, media_type, status)
          VALUES (?, 'p', 'https://instagram.com/reel/x', 'instagram', 'reel', 'completed')`,
    args: [id],
  });
}

describe("DELETE /api/analyses (#312/#281 audit P2)", () => {
  it("deletes an existing row and returns { success: true }", async () => {
    const id = randomUUID();
    await insertAnalysis(id);

    const response = await route.DELETE(makeDeleteRequest(id));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });

    const check = await db.execute({ sql: "SELECT 1 FROM analyses WHERE id = ?", args: [id] });
    expect(check.rows.length).toBe(0);
  });

  it("returns 404 for an id that does not exist, never a fabricated success", async () => {
    const response = await route.DELETE(makeDeleteRequest(randomUUID()));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Analysis not found.");
  });

  it("400 when id is missing", async () => {
    const response = await route.DELETE(makeDeleteRequest());
    expect(response.status).toBe(400);
  });

  it("401 when unauthenticated", async () => {
    isAuthenticatedMock.mockResolvedValue(false);
    const response = await route.DELETE(makeDeleteRequest(randomUUID()));
    expect(response.status).toBe(401);
  });
});
