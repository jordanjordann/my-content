import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { db } from "../lib/server/db";

async function main() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const existing = await db.execute({
      sql: "SELECT name FROM _migrations WHERE name = ? LIMIT 1",
      args: [file],
    });

    if (existing.rows.length > 0) {
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await db.executeMultiple(sql);
    await db.execute({
      sql: "INSERT INTO _migrations (name) VALUES (?)",
      args: [file],
    });

    console.log(`Applied ${file}`);
  }

  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
