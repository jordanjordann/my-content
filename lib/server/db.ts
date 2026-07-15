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
        a.created_at,
        a.updated_at,
        COUNT(ci.id) as item_count
      FROM analyses a
      LEFT JOIN content_items ci ON ci.analysis_id = a.id
      GROUP BY a.id
      ORDER BY a.updated_at DESC
    `,
    args: [],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    prompt: row.prompt as string,
    status: row.status as string,
    itemCount: Number(row.item_count),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

export async function getUniqueAccounts() {
  const result = await db.execute({
    sql: "SELECT DISTINCT username FROM content_items ORDER BY username",
    args: [],
  });

  return result.rows.map((row) => row.username as string);
}

export async function getAnalysisPlatforms(analysisId: string) {
  const result = await db.execute({
    sql: "SELECT DISTINCT platform FROM content_items WHERE analysis_id = ? ORDER BY platform",
    args: [analysisId],
  });

  return result.rows.map((row) => row.platform as string);
}

export async function getAnalysisResult(analysisId: string) {
  const result = await db.execute({
    sql: "SELECT content FROM analysis_results WHERE analysis_id = ? LIMIT 1",
    args: [analysisId],
  });

  const row = result.rows[0];
  return row ? (row.content as string) : null;
}

export async function getAnalysisDetail(analysisId: string) {
  const analysisResult = await db.execute({
    sql: "SELECT id, prompt, status, created_at FROM analyses WHERE id = ? LIMIT 1",
    args: [analysisId],
  });

  const analysisRow = analysisResult.rows[0];
  if (!analysisRow) {
    return null;
  }

  const itemsResult = await db.execute({
    sql: `
      SELECT
        id,
        analysis_id,
        url,
        platform,
        media_type,
        username,
        thumbnail_url,
        video_url,
        duration_sec,
        view_count,
        post_date,
        caption,
        created_at
      FROM content_items
      WHERE analysis_id = ?
      ORDER BY created_at ASC
    `,
    args: [analysisId],
  });

  const items = itemsResult.rows.map((row) => ({
    id: row.id as string,
    analysisId: row.analysis_id as string,
    url: row.url as string,
    platform: row.platform as string,
    mediaType: row.media_type as string,
    username: row.username as string,
    thumbnailUrl: (row.thumbnail_url as string) ?? null,
    videoUrl: (row.video_url as string) ?? null,
    durationSec: row.duration_sec ? Number(row.duration_sec) : null,
    viewCount: row.view_count ? Number(row.view_count) : null,
    postDate: (row.post_date as string) ?? null,
    caption: (row.caption as string) ?? null,
    createdAt: row.created_at as string,
  }));

  return {
    id: analysisRow.id as string,
    prompt: analysisRow.prompt as string,
    status: analysisRow.status as string,
    createdAt: analysisRow.created_at as string,
    items,
  };
}

export async function deleteAnalysis(analysisId: string) {
  await db.execute({
    sql: "DELETE FROM analyses WHERE id = ?",
    args: [analysisId],
  });
}
