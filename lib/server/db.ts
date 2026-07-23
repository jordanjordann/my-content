import { createClient } from "@libsql/client";

const databaseUrl = process.env.TURSO_DATABASE_URL ?? "file:./my-content.db";

export const db = createClient({
  url: databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function getSetting(key: string) {
  const result = await db.execute({
    sql: "SELECT value FROM settings WHERE key = ? LIMIT 1",
    args: [key],
  });

  const row = result.rows[0];
  return typeof row?.value === "string" ? row.value : null;
}

export async function setSetting(key: string, value: string) {
  await db.execute({
    sql: `
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value
    `,
    args: [key, value],
  });
}

export async function deleteSettings(keys: string[]) {
  if (keys.length === 0) {
    return;
  }

  await db.execute({
    sql: `DELETE FROM settings WHERE key IN (${keys.map(() => "?").join(", ")})`,
    args: keys,
  });
}

// Analysis query helpers

export async function getAnalysesList() {
  const result = await db.execute({
    sql: `
      SELECT
        a.id,
        a.prompt,
        a.status,
        a.title,
        a.url,
        a.platform,
        a.media_type,
        a.username,
        a.thumbnail_url,
        a.view_count,
        a.post_date,
        a.caption,
        a.duration_sec,
        a.result_content,
        a.schema_version,
        a.created_at,
        a.updated_at
      FROM analyses a
      ORDER BY a.updated_at DESC
    `,
    args: [],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    prompt: (row.prompt as string) ?? null,
    status: row.status as string,
    title: (row.title as string) ?? null,
    url: row.url as string,
    platform: row.platform as string,
    mediaType: row.media_type as string,
    username: row.username as string,
    thumbnailUrl: (row.thumbnail_url as string) ?? null,
    viewCount: row.view_count == null ? null : Number(row.view_count),
    postDate: (row.post_date as string) ?? null,
    caption: (row.caption as string) ?? null,
    durationSec: row.duration_sec == null ? null : Number(row.duration_sec),
    resultContent: (row.result_content as string) ?? null,
    schemaVersion: row.schema_version == null ? null : Number(row.schema_version),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

export async function getUniqueAccounts() {
  const result = await db.execute({
    sql: "SELECT DISTINCT username FROM analyses WHERE username IS NOT NULL ORDER BY username",
    args: [],
  });

  return result.rows.map((row) => row.username as string);
}

export async function getAnalysisDetail(analysisId: string) {
  const analysisResult = await db.execute({
    sql: `
      SELECT id, prompt, status, title, url, platform, media_type, username,
             thumbnail_url, view_count, post_date, caption, duration_sec,
             result_content, schema_version, created_at
      FROM analyses
      WHERE id = ?
      LIMIT 1
    `,
    args: [analysisId],
  });

  const analysisRow = analysisResult.rows[0];
  if (!analysisRow) {
    return null;
  }

  return {
    id: analysisRow.id as string,
    prompt: (analysisRow.prompt as string) ?? null,
    status: analysisRow.status as string,
    title: (analysisRow.title as string) ?? null,
    url: analysisRow.url as string,
    platform: analysisRow.platform as string,
    mediaType: analysisRow.media_type as string,
    username: analysisRow.username as string,
    thumbnailUrl: (analysisRow.thumbnail_url as string) ?? null,
    viewCount: analysisRow.view_count == null ? null : Number(analysisRow.view_count),
    postDate: (analysisRow.post_date as string) ?? null,
    caption: (analysisRow.caption as string) ?? null,
    durationSec: analysisRow.duration_sec == null ? null : Number(analysisRow.duration_sec),
    resultContent: (analysisRow.result_content as string) ?? null,
    schemaVersion: analysisRow.schema_version == null ? null : Number(analysisRow.schema_version),
    createdAt: analysisRow.created_at as string,
  };
}

export async function deleteAnalysis(analysisId: string) {
  await db.execute({
    sql: "DELETE FROM analyses WHERE id = ?",
    args: [analysisId],
  });
}
