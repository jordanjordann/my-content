import { SCORECARD_RUBRICS, type ScorecardDimension } from "./rubrics";
import { buildTaxonomyPrompt } from "./taxonomyPrompt";

/**
 * System instruction assembly (PRD §4, §5; TDD §5.3).
 *
 * Reduced to: role framing + rubric block + taxonomy block + output-language
 * rule. The hand-written "Respond with ONLY valid JSON matching this
 * structure" block that used to sit at the bottom of this file is DELETED —
 * `responseSchema` (#66) now carries the output shape, and keeping a prose
 * copy here would have guaranteed the two eventually disagree.
 */

const DIMENSION_LABELS: Record<ScorecardDimension, string> = {
  hookStrength: "Hook Strength",
  retentionFlow: "Retention Flow",
  visualPolish: "Visual Polish",
  ctaEffectiveness: "CTA Effectiveness",
  messageClarity: "Message Clarity",
  originality: "Originality",
  emotionalResonance: "Emotional Resonance",
};

const SCORECARD_DIMENSIONS: readonly ScorecardDimension[] = [
  "hookStrength",
  "retentionFlow",
  "visualPolish",
  "ctaEffectiveness",
  "messageClarity",
  "originality",
  "emotionalResonance",
];

function buildRubricBlock(): string {
  const dimensionBlocks = SCORECARD_DIMENSIONS.map((dimension) => {
    const bands = SCORECARD_RUBRICS[dimension];
    const bandLines = bands.map((band, index) => `  ${index + 1}. ${band}`).join("\n");
    return `### ${DIMENSION_LABELS[dimension]} (\`${dimension}\`)\n\n${bandLines}`;
  });

  return `## Dimensi Skor (skala 1-5)

Setiap dimensi berikut dinilai 1 sampai 5 menggunakan definisi band yang sudah ditentukan di bawah
ini. JANGAN menilai berdasarkan kesan umum — cocokkan apa yang benar-benar teramati di video dengan
SATU definisi band yang paling sesuai, lalu gunakan angka band tersebut sebagai skor. Skor HARUS
berupa bilangan bulat 1-5; jangan gunakan angka desimal atau di luar rentang ini.

${dimensionBlocks.join("\n\n")}`;
}

export function buildSystemInstruction(): string {
  return `Anda adalah Senior social media analyst. Spesialisasi Anda adalah konten Instagram dan YouTube untuk pasar Indonesia.

Analisis konten yang dikirimkan dan berikan evaluasi terstruktur mengikuti kontrak data yang
diberikan (Tier 1: atribut gaya, Tier 2: skor performa). Video dapat berupa satu klip, atau
carousel multi-slide (gambar dan/atau video) yang harus dianalisis sebagai satu kesatuan.

${buildRubricBlock()}

${buildTaxonomyPrompt()}

## Bahasa Output

Gunakan BAHASA INDONESIA untuk semua teks bebas (ringkasan, kekuatan, kelemahan, momen kunci, red
flags, saran, teks hook, teks di layar, catatan gaya caption, pola nada verbal, subtopik). Identifier
enum (\`hookType\`, \`formatArchetype\`, \`ctaType\`, \`ctaTiming\`, \`topicNiche\`, \`beatType\`, \`pacing\`)
TETAP dalam Bahasa Inggris persis seperti yang tercantum di atas — jangan diterjemahkan.`;
}
