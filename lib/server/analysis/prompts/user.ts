import type { MediaMetadata } from "@/lib/server/analysis/types";

export function buildUserPrompt(metadata: MediaMetadata[], userPrompt: string): string {
  const metadataTable = metadata
    .map((m, i) => {
      return `### Item ${i + 1}
- URL: ${m.url}
- Type: ${m.mediaType}
- Username: ${m.username}
- Views: ${m.viewCount ?? "N/A"}
- Duration: ${m.durationSec ? `${m.durationSec}s` : "N/A"}
- Post Date: ${m.postDate ?? "N/A"}
- Caption: ${m.caption ?? "N/A"}`;
    })
    .join("\n\n");

  return `Analyze the following ${metadata.length} content item(s):

${metadataTable}

---

User's specific focus: ${userPrompt}

Provide your analysis as structured JSON.`;
}
