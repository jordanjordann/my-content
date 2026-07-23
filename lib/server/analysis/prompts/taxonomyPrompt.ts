import {
  CTA_TIMING_LABELS,
  CTA_TIMINGS,
  CTA_TYPE_LABELS,
  CTA_TYPES,
  FORMAT_ARCHETYPE_LABELS,
  FORMAT_ARCHETYPES,
  HOOK_TYPE_LABELS,
  HOOK_TYPES,
  TOPIC_NICHE_LABELS,
  TOPIC_NICHES,
} from "@/lib/analysis/taxonomy";
import type { CtaTiming, CtaType, FormatArchetype, HookType } from "@/lib/analysis/taxonomy";

/**
 * Taxonomy block for the system instruction (PRD §4.3, §5.2).
 *
 * HARD RULE (ticket #67, mirrors TDD §2.2): this file must contain NO literal
 * enum-value list. Every identifier rendered below is read off the arrays in
 * `lib/analysis/taxonomy/constants.ts` (`HOOK_TYPES`, `FORMAT_ARCHETYPES`,
 * `CTA_TYPES`, `CTA_TIMINGS`, `TOPIC_NICHES`). Per-value prose (definition,
 * localized few-shot example) lives in the `Record<Union, ...>` objects below
 * — these are exhaustive (a new taxonomy value fails to compile without an
 * entry), which is the same pattern `labels.ts` already uses, not a second
 * enum list.
 *
 * Few-shot examples are Indonesian-localized per PRD §4.3.5: the source PDF's
 * American subject matter ("tier list", "9-5", "de-influence", US home
 * renovation) is deliberately NOT reproduced here — every example below uses
 * Indonesian creator-economy subject matter so Gemini anchors on the
 * *rhetorical strategy*, not on US content.
 */

interface TaxonomyEntry {
  definition: string;
  /** Indonesian-localized few-shot line. Omitted for pure escape-hatch values. */
  example?: string;
}

const HOOK_TYPE_ENTRIES: Record<HookType, TaxonomyEntry> = {
  DIRECT_VALUE_PROMISE: {
    definition:
      "Menyatakan secara langsung apa yang akan didapat/dipelajari penonton, sering dengan kompresi waktu atau usaha. Framing tutorial.",
    example: "\"Cara bikin kulit glowing cuma pakai 3 produk, hasilnya kelihatan dalam 7 hari.\"",
  },
  NUMBERED_LIST: {
    definition: "Dibuka dengan hitungan, daftar, atau peringkat eksplisit sebagai kerangka video.",
    example: "\"5 kesalahan skincare yang bikin jerawatmu nggak sembuh-sembuh.\"",
  },
  CURIOSITY_QUESTION: {
    definition: "Dibuka dengan pertanyaan langsung yang jawabannya sengaja ditahan.",
    example: "\"Kenapa warung ini selalu antre padahal harganya paling mahal di jalan ini?\"",
  },
  SIDE_BY_SIDE_COMPARISON: {
    definition:
      "Dua opsi/kelompok/kuantitas konkret disandingkan, biasanya dengan kesetaraan visual (dua item ditampilkan bersamaan).",
    example: "\"Ini bedanya skincare 50 ribu sama yang 500 ribu — dibandingin langsung di kulit yang sama.\"",
  },
  MYTH_CORRECTION: {
    definition:
      "Menyatakan sebuah keyakinan yang banyak dipercaya itu salah, lalu mengoreksinya. Mengutip atau menyiratkan bukti.",
    example: "\"Banyak yang percaya minum air es bikin gendut. Faktanya, ini yang studi tunjukkan...\"",
  },
  WARNING_MISTAKE: {
    definition: "Larangan imperatif atau peringatan konsekuensi. Framing kehilangan (loss-framed).",
    example: "\"Jangan pernah simpan skincare-mu di kamar mandi — ini alasannya.\"",
  },
  CONTRARIAN_OPINION: {
    definition:
      "Mengambil posisi pribadi yang berisiko secara sosial, berlawanan dengan konsensus. Disampaikan sebagai keyakinan pribadi, bukan koreksi fakta.",
    example: "\"Menurutku kerja 9 jam sehari itu bikin kita nggak produktif — dan aku nggak peduli kalau kamu nggak setuju.\"",
  },
  SECRET_INSIDER_REVEAL: {
    definition: "Membingkai konten sebagai pengetahuan yang disembunyikan, dijaga ketat, atau keuntungan yang tidak adil.",
    example: "\"Ini trik yang cuma dipakai orang dalam industri kecantikan, jarang dibagi ke publik.\"",
  },
  RESULT_PROOF: {
    definition:
      "Membuka dengan hasil nyata yang sudah dicapai atau transformasi sebelum→sesudah sebagai bukti. Menyerap pembukaan berbasis kredensial/otoritas.",
    example: "\"Ini portofolio investasiku setelah 3 tahun konsisten — dari modal 5 juta jadi segini.\"",
  },
  PERSONAL_STORY_OPENER: {
    definition:
      "Dibuka di tengah narasi dengan penanda waktu atau kejadian pemicu; hasilnya adalah cerita itu sendiri. Menyerap pembukaan pengakuan/kerentanan.",
    example: "\"Dua tahun lalu aku ditolak 10 kali sebelum akhirnya usaha ini jalan.\"",
  },
  PROCESS_JOURNEY_SERIES: {
    definition: "Memposisikan video sebagai bagian dari usaha berseri yang sedang berlangsung. Termasuk keseharian (day-in-the-life).",
    example: "\"Hari ke-12 belajar masak dari nol, hari ini aku coba bikin rendang.\"",
  },
  VISUAL_DEMONSTRATION: {
    definition:
      "Tunjukkan-jangan-ceritakan: menunjuk SATU objek di layar lalu langsung mulai mengerjakan/membangun/mengungkapnya.",
    example: "\"Ini blender baruku — lihat gimana dia hancurin es batu dalam 5 detik.\"",
  },
  SHOCK_STATEMENT: {
    definition: "Satu pernyataan yang mengejutkan atau mengkhawatirkan tanpa pengantar.",
    example: "\"80% orang Indonesia ternyata kekurangan vitamin D.\"",
  },
  RELATABLE_PAIN_POINT: {
    definition: "Menyebutkan frustrasi yang sudah dialami penonton. Pengenalan (recognition), bukan janji atau instruksi.",
    example: "\"Capek nggak sih tiap gajian langsung habis buat cicilan doang?\"",
  },
  EXPERIMENT_CHALLENGE: {
    definition:
      "Framing \"aku coba X selama N hari/minggu\" — ditambahkan khusus untuk pasar Indonesia karena jauh lebih umum di konten pendek Indonesia dibanding korpus sumber yang berbasis AS.",
    example: "\"Aku coba bangun jam 4 pagi selama 30 hari, ini yang terjadi.\"",
  },
  TEXT_OVERLAY_ONLY: {
    definition: "Dibuka dengan teks di layar sebagai hook, tanpa hook verbal sama sekali.",
    example: "Teks di layar: \"POV: kamu baru sadar gajian habis di minggu kedua.\" — tanpa suara/dialog pembuka.",
  },
  COLD_OPEN_ACTION: {
    definition: "Dibuka dengan aksi diam / audio yang sedang tren / tanpa hook verbal atau teks sama sekali.",
    example: "Langsung adegan aksi diiringi audio yang sedang viral, tanpa dialog atau teks pembuka.",
  },
  OTHER: {
    definition: "Kategori pelarian (escape hatch) untuk hook yang tidak cocok dengan 17 tipe di atas.",
  },
};

const FORMAT_ARCHETYPE_ENTRIES: Record<FormatArchetype, TaxonomyEntry> = {
  TALKING_HEAD: {
    definition: "Orang berbicara langsung ke kamera; wajahnya adalah visual utama sepanjang video.",
    example: "Kreator duduk di depan kamera menjelaskan topik sambil menatap lensa sepanjang video.",
  },
  VOICEOVER_BROLL: {
    definition: "Narasi di atas rekaman yang bukan gambar si pembicara.",
    example: "Suara narasi menjelaskan proses sementara visual menampilkan rekaman b-roll produk/aktivitas.",
  },
  POV_SKIT: {
    definition: "Skenario yang diperankan atau berkarakter; framing \"POV:\", komedi sketsa.",
    example: "\"POV: kamu pelanggan yang baru pertama kali ke salon dan capster-nya julid.\"",
  },
  TUTORIAL_DEMO: {
    definition: "Instruksi langkah-demi-langkah yang menunjukkan sebuah proses yang bisa ditiru penonton, sedang dilakukan.",
    example: "Kreator menunjukkan tiap langkah membuat kopi susu dari awal sampai jadi.",
  },
  PRODUCT_REVIEW: {
    definition: "Mengevaluasi atau memamerkan satu produk tertentu.",
    example: "Kreator mencoba dan menilai satu produk skincare, membahas kelebihan dan kekurangannya.",
  },
  TRANSFORMATION_REVEAL: {
    definition: "Struktur sebelum→sesudah — makeover, hasil renovasi/bangunan, glow-up.",
    example: "Video menunjukkan kondisi kamar sebelum dirapikan, lalu hasil akhirnya.",
  },
  GREEN_SCREEN_COMMENTARY: {
    definition: "Kreator ditampilkan di atas media statis yang direferensikan (artikel, tangkapan layar, postingan).",
    example: "Kreator berdiri di depan tangkapan layar berita sambil mengomentarinya.",
  },
  REACTION_STITCH: {
    definition: "Merespons video orang lain secara langsung/inline (duet atau stitch).",
    example: "Kreator men-duet video orang lain dan bereaksi langsung terhadap isinya.",
  },
  INTERVIEW_STREET: {
    definition: "Tanya-jawab dengan orang lain; wawancara jalanan (vox pop).",
    example: "Kreator mewawancarai orang-orang di jalan tentang pendapat mereka soal suatu topik.",
  },
  TEXT_SLIDESHOW: {
    definition: "Rangkaian kartu teks atau gambar, minim atau tanpa bicara — TAPI merupakan sebuah VIDEO, bukan post carousel.",
    example: "Video berisi rangkaian slide teks yang menjelaskan fakta, tanpa suara kreator.",
  },
  VLOG_DAILY: {
    definition: "Gaya dokumenter, mengikuti sebuah aktivitas atau keseharian.",
    example: "Video mengikuti keseharian kreator dari pagi sampai malam tanpa skrip ketat.",
  },
  PROCESS_ASMR: {
    definition: "Rekaman proses yang memuaskan untuk ditonton, dengan narasi minim atau tidak signifikan.",
    example: "Rekaman tangan meracik adonan kue tanpa suara bicara, hanya suara proses.",
  },
  PERFORMANCE: {
    definition: "Dance, lip-sync, musik, atau format audio yang sedang tren, tanpa skenario/karakter.",
    example: "Kreator menari mengikuti audio yang sedang viral.",
  },
  CAROUSEL_STATIC: {
    definition:
      "Postingan carousel multi-gambar dengan TIDAK ADA konten video sama sekali (bukan video yang dipotong jadi kartu teks).",
    example: "Postingan carousel 7 slide gambar tanpa video, membahas tips finansial.",
  },
  OTHER: {
    definition: "Kategori pelarian (escape hatch) untuk format produksi yang tidak cocok dengan 14 tipe di atas.",
  },
};

const CTA_TYPE_ENTRIES: Record<CtaType, TaxonomyEntry> = {
  FOLLOW: {
    definition: "Ajakan follow/subscribe.",
    example: "\"Follow biar nggak ketinggalan konten kayak gini.\"",
  },
  COMMENT_PROMPT: {
    definition: "Ajakan bertanya atau mengajak \"komen X di bawah\".",
    example: "\"Komen 'AKU MAU' di bawah kalau kamu pengen tau caranya.\"",
  },
  SAVE_PROMPT: {
    definition: "Ajakan \"simpan ini buat nanti\".",
    example: "\"Save dulu postingan ini biar nggak lupa.\"",
  },
  SHARE_PROMPT: {
    definition: "Ajakan \"kirim ini ke seseorang yang…\".",
    example: "\"Kirim ke temenmu yang lagi galau soal ini.\"",
  },
  LINK_IN_BIO: {
    definition: "Mengarahkan ke link di bio profil.",
    example: "\"Link lengkapnya ada di bio ya.\"",
  },
  SHOP_PURCHASE: {
    definition: "Beli — checkout, TikTok Shop / Shopee.",
    example: "\"Cek keranjang kuning di pojok kanan bawah buat checkout sekarang.\" / \"Langsung checkout di keranjang ya.\"",
  },
  DM_INQUIRY: {
    definition: "\"DM aku,\" \"chat admin.\"",
    example: "\"Chat admin kita buat tanya-tanya harga.\"",
  },
  JOIN_COMMUNITY: {
    definition: "Grup WhatsApp/Telegram, kelas, waitlist.",
    example: "\"Gabung grup WA kita, link ada di bio.\"",
  },
  SIGN_UP_REGISTER: {
    definition: "Formulir, webinar, pendaftaran event.",
    example: "\"Daftar webinar gratisnya sekarang, kuota terbatas.\"",
  },
  WATCH_NEXT: {
    definition: "Part 2 / lanjutan seri.",
    example: "\"Lanjutannya ada di part 2, langsung cek ya.\"",
  },
  DISCOUNT_CODE: {
    definition: "\"Pakai kode X.\"",
    example: "\"Pakai kode DISKON20 buat potongan harga.\"",
  },
  NONE: {
    definition: "Tidak ada ajakan bertindak eksplisit di video ini.",
  },
  OTHER: {
    definition: "Ajakan lain yang tidak cocok dengan 11 tipe di atas.",
  },
};

const CTA_TIMING_MEANINGS: Record<CtaTiming, string> = {
  EARLY: "Ajakan muncul di bagian pembuka, sebelum payoff/isi utama disampaikan.",
  MID: "Ajakan muncul di bagian isi, biasanya tepat setelah payoff/reveal.",
  END: "Ajakan muncul di bagian penutup, setelah isi selesai disampaikan.",
  NONE: "Tidak ada ajakan bertindak di video ini.",
};

function renderEntries<Union extends string>(
  values: readonly Union[],
  entries: Record<Union, TaxonomyEntry>,
  labels: Record<Union, string>,
): string {
  return values
    .map((id) => {
      const entry = entries[id];
      const label = labels[id];
      const exampleLine = entry.example ? `\n  Contoh: ${entry.example}` : "";
      return `- \`${id}\` (${label}): ${entry.definition}${exampleLine}`;
    })
    .join("\n");
}

/** `topicNiche` has no per-value definition/example — it is a broad label plus free-text `topicSubtopic`. */
function renderIdentifiersAndLabels<Union extends string>(
  values: readonly Union[],
  labels: Record<Union, string>,
): string {
  return values.map((id) => `- \`${id}\` (${labels[id]})`).join("\n");
}

const DISCRIMINATOR_RULES = `## Aturan Pembeda (Discriminator Rules)

Pasangan berikut sering tertukar. Ikuti aturan ini secara eksplisit saat memilih label:

**hookType:**
- \`VISUAL_DEMONSTRATION\` vs \`SIDE_BY_SIDE_COMPARISON\` — keduanya bisa dibuka dengan "Ini (benda)…". Jika DUA item dikontraskan/dibandingkan → \`SIDE_BY_SIDE_COMPARISON\`. Jika HANYA SATU item ditunjukkan → \`VISUAL_DEMONSTRATION\`.
- \`MYTH_CORRECTION\` vs \`CONTRARIAN_OPINION\` — jika hook mengutip atau menyiratkan bukti/fakta → \`MYTH_CORRECTION\`. Jika hook dinyatakan sebagai keyakinan/opini pribadi tanpa klaim bukti → \`CONTRARIAN_OPINION\`.

**formatArchetype:**
- \`VOICEOVER_BROLL\` vs \`PROCESS_ASMR\` — jika narasi membawa makna utama video → \`VOICEOVER_BROLL\`. Jika rekaman visual yang membawa makna dan narasi tidak ada atau tidak signifikan → \`PROCESS_ASMR\`.
- \`TUTORIAL_DEMO\` vs \`PRODUCT_REVIEW\` — jika video mengajarkan proses yang bisa diulang penonton sendiri → \`TUTORIAL_DEMO\`. Jika video mengevaluasi/memamerkan satu produk tertentu → \`PRODUCT_REVIEW\`.
- \`POV_SKIT\` vs \`PERFORMANCE\` — jika ada skenario yang diperankan dengan karakter dan alur cerita → \`POV_SKIT\`. Jika berupa dance/lip-sync/eksekusi audio tren tanpa skenario → \`PERFORMANCE\`.
- \`TALKING_HEAD\` vs \`GREEN_SCREEN_COMMENTARY\` — jika kreator sendirian di frame → \`TALKING_HEAD\`. Jika kreator ditampilkan di atas media yang direferensikan (artikel, screenshot, post) → \`GREEN_SCREEN_COMMENTARY\`.
- \`REACTION_STITCH\` vs \`GREEN_SCREEN_COMMENTARY\` — keduanya mereferensikan konten pihak ketiga. Jika bereaksi terhadap VIDEO lain secara inline (duet/stitch) → \`REACTION_STITCH\`. Jika mengomentari artefak STATIS (artikel, tangkapan layar, postingan) → \`GREEN_SCREEN_COMMENTARY\`.
- \`TEXT_SLIDESHOW\` vs \`CAROUSEL_STATIC\` — \`CAROUSEL_STATIC\` hanya untuk postingan carousel multi-gambar asli tanpa konten video sama sekali. Sebuah VIDEO yang tersusun dari kartu teks/gambar tetap \`TEXT_SLIDESHOW\`.

**ctaType:**
- \`SHOP_PURCHASE\` ditandai dengan frasa seperti "keranjang kuning" atau "checkout di keranjang".
- \`JOIN_COMMUNITY\` ditandai dengan frasa seperti "gabung grup WA".`;

const HAS_AUDIENCE_CALLOUT_NOTE = `## \`hasAudienceCallout\` — Orthogonal terhadap \`hookType\`

\`hasAudienceCallout\` adalah boolean TERPISAH, bukan bagian dari \`hookType\`. Frasa penargetan audiens
seperti "Buat kamu yang…" HANYA menentukan nilai \`hasAudienceCallout\`, dan TIDAK membatasi atau
mengubah pilihan \`hookType\`. Sebuah video bisa sekaligus berupa audience callout DAN
\`NUMBERED_LIST\` DAN \`WARNING_MISTAKE\` — pilih \`hookType\` berdasarkan strategi retorika inti,
lalu set \`hasAudienceCallout\` secara independen berdasarkan ada/tidaknya penargetan audiens
eksplisit. Jangan pernah menjatuhkan video seperti ini ke \`OTHER\` hanya karena mengandung
penargetan audiens.`;

const CTA_CONSISTENCY_RULE = `## Aturan Konsistensi \`ctaType\` / \`ctaTiming\`

\`ctaType\` dan \`ctaTiming\` harus konsisten secara biconditional:
- Jika TIDAK ADA ajakan bertindak di video, \`ctaType\` HARUS berupa \`["NONE"]\` (bukan array kosong) DAN \`ctaTiming\` HARUS \`NONE\`.
- Jika ADA ajakan bertindak apa pun, \`ctaType\` HARUS berisi nilai selain \`NONE\`, DAN \`ctaTiming\` HARUS salah satu dari \`EARLY\`/\`MID\`/\`END\` (tidak boleh \`NONE\`).
- Kombinasi lain (\`ctaType\` berisi ajakan nyata tapi \`ctaTiming: NONE\`, atau \`ctaType: ["NONE"]\` dengan \`ctaTiming\` selain \`NONE\`) tidak valid — jangan pernah menghasilkannya.
- Jika video memiliki beberapa ajakan yang menumpuk di titik berbeda, \`ctaTiming\` mencatat posisi ajakan yang PALING MENONJOL/utama saja.`;

export function buildTaxonomyPrompt(): string {
  const sections = [
    `## Taksonomi \`topicNiche\`

Kategori utama topik konten. Pilih nilai yang paling sesuai; isi \`topicSubtopic\` dengan deskripsi
spesifik dalam Bahasa Indonesia (bebas, tidak perlu cocok persis dengan daftar ini). Klasifikasi
\`OTHER\` yang sering muncul adalah SINYAL yang valid, bukan kegagalan — jangan dipaksakan ke
kategori lain jika memang tidak cocok.

${renderIdentifiersAndLabels(TOPIC_NICHES, TOPIC_NICHE_LABELS)}`,
    `## Taksonomi \`hookType\` (strategi retorika pembuka video)

Pilih SATU \`hookType\` utama. Jika hook secara genuine membawa dua strategi sekaligus, isi
\`hookTypeSecondary\` dengan strategi kedua (nilai yang sama dengan \`hookType\`, atau \`"NONE"\` jika
tidak ada strategi kedua yang jelas). Jangan memaksakan strategi kedua jika hanya ada satu.

${renderEntries(HOOK_TYPES, HOOK_TYPE_ENTRIES, HOOK_TYPE_LABELS)}`,
    `## Taksonomi \`formatArchetype\` (bentuk produksi video)

\`formatArchetype\` menjelaskan bagaimana video SECARA FISIK dibuat/diambil — berbeda dari
\`hookType\` (bagaimana video dibuka) dan \`topicNiche\` (video ini tentang apa).

${renderEntries(FORMAT_ARCHETYPES, FORMAT_ARCHETYPE_ENTRIES, FORMAT_ARCHETYPE_LABELS)}`,
    `## Taksonomi \`ctaType\` (array — bisa lebih dari satu)

\`ctaType\` adalah ARRAY, karena video sering menumpuk beberapa ajakan sekaligus ("follow, save,
link di bio"). Jika TIDAK ADA ajakan bertindak, gunakan \`["NONE"]\` — array kosong TIDAK VALID.
Jika \`NONE\` digunakan, itu HARUS menjadi satu-satunya elemen dalam array.

${renderEntries(CTA_TYPES, CTA_TYPE_ENTRIES, CTA_TYPE_LABELS)}`,
    `## Taksonomi \`ctaTiming\` (satu nilai — posisi ajakan utama)

${CTA_TIMINGS.map((id) => `- \`${id}\` (${CTA_TIMING_LABELS[id]}): ${CTA_TIMING_MEANINGS[id]}`).join("\n")}`,
    DISCRIMINATOR_RULES,
    HAS_AUDIENCE_CALLOUT_NOTE,
    CTA_CONSISTENCY_RULE,
  ];

  return sections.join("\n\n");
}
