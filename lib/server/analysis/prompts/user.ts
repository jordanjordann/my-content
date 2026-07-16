import type { MediaMetadata } from "@/lib/server/analysis/types";

export function buildUserPrompt(metadata: MediaMetadata, userPrompt: string): string {
  return `Analyze the following content:

- URL: ${metadata.url}
- Type: ${metadata.mediaType}
- Username: ${metadata.username}
- Views: ${metadata.viewCount ?? "N/A"}
- Duration: ${metadata.durationSec ? `${metadata.durationSec}s` : "N/A"}
- Post Date: ${metadata.postDate ?? "N/A"}
- Caption: ${metadata.caption ?? "N/A"}

---

User's specific focus: ${userPrompt}

Berikan analisis Anda dalam BAHASA INDONESIA sebagai JSON terstruktur.`;
}
