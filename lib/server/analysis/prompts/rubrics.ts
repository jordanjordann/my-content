/**
 * Anchored 5-band rubrics for the Tier 2 scorecard (PRD §4.5, §4.6; TDD §5.1).
 *
 * `ScorecardDimension` mirrors the 7-key `Scorecard` contract from TDD §3.2
 * (`lib/server/analysis/types/analysis.ts`, owned/rewritten by #68 — not
 * imported from here so this ticket does not reach into a file it does not
 * own). Keep the two lists in lockstep if either changes.
 *
 * `RubricBands` is a fixed 5-tuple, not `string[]`. This is deliberate: it
 * makes "add a dimension without writing all five bands" a COMPILE ERROR
 * rather than a silent gap. Under-specified rubrics (a name and a one-line
 * gloss) are exactly how the pre-redesign prompt ended up with
 * non-comparable, non-reproducible scores.
 *
 * Every band describes an OBSERVABLE property of the video, never a bare
 * adjective ("hook menyebutkan manfaat konkret dalam 2 detik pertama", not
 * "hook yang baik") — PRD §5.3.
 */

export type ScorecardDimension =
  | "hookStrength"
  | "retentionFlow"
  | "visualPolish"
  | "ctaEffectiveness"
  | "messageClarity"
  | "originality"
  | "emotionalResonance";

/** Band 1 = weakest observed property, band 5 = strongest. */
export type RubricBands = readonly [string, string, string, string, string];

export const SCORECARD_RUBRICS: Record<ScorecardDimension, RubricBands> = {
  hookStrength: [
    "Hook tidak menyampaikan janji, pertanyaan, atau ketegangan apa pun dalam 3 detik pertama; penonton tidak diberi alasan untuk terus menonton.",
    "Hook menyebutkan topik secara umum tapi tanpa detail konkret atau ketegangan yang jelas dalam 3 detik pertama.",
    "Hook menyampaikan satu janji atau pertanyaan yang jelas dalam 3 detik pertama, namun eksekusi visual/verbalnya datar dan tidak mendukung.",
    "Hook menyampaikan janji atau ketegangan konkret dalam 3 detik pertama, didukung oleh visual atau nada suara yang relevan dengan isi janji tersebut.",
    "Hook menyebutkan manfaat atau ketegangan konkret dalam 2 detik pertama, dengan visual dan verbal yang saling memperkuat sehingga tidak ada jeda kosong sebelum penonton tahu apa yang akan mereka dapatkan.",
  ],
  retentionFlow: [
    "Video kehilangan arah di tengah durasi; ada jeda kosong atau pengulangan tanpa perkembangan baru, memberi alasan kuat untuk berhenti menonton sebelum akhir.",
    "Struktur di bagian tengah video terasa lambat atau berulang pada beberapa segmen, dengan transisi antar-poin yang tidak jelas.",
    "Video mempertahankan satu alur yang bisa diikuti dari awal sampai akhir, tapi ritme antar-segmen tidak konsisten (ada bagian cepat lalu tiba-tiba melambat tanpa alasan yang terlihat).",
    "Video mempertahankan momentum dari hook ke isi ke penutup, dengan transisi antar-segmen yang mulus dan durasi tiap segmen terasa proporsional terhadap isinya.",
    "Setiap segmen membangun ketegangan atau informasi baru yang secara eksplisit mendorong penonton menonton segmen berikutnya, dengan ritme cut yang menyesuaikan intensitas konten dari awal sampai akhir.",
  ],
  visualPolish: [
    "Editing kasar: cut tidak menyesuaikan beat musik atau ritme bicara, dan framing/pencahayaan/stabilitas gambar tidak konsisten sepanjang video.",
    "Ada upaya editing dasar, tapi cut sering meleset dari beat musik atau jeda bicara, dan kualitas visual (framing, pencahayaan, stabilitas) berubah-ubah sepanjang video.",
    "Cut mengikuti beat musik atau ritme bicara pada sebagian besar video, dengan framing dan pencahayaan cukup stabil meski ada beberapa momen yang terasa kasar.",
    "Cut secara konsisten selaras dengan beat musik/SFX dan ritme bicara di seluruh video, transisi rapi, framing dan pencahayaan stabil sepanjang durasi.",
    "Timing cut presisi mengikuti beat musik dan penekanan verbal di setiap segmen, transisi dan color grading terasa disengaja, sehingga audio dan visual terasa dirancang sebagai satu kesatuan.",
  ],
  ctaEffectiveness: [
    "Ajakan bertindak tidak disampaikan secara verbal maupun visual yang bisa dikenali, atau disampaikan tanpa konteks apa pun sehingga terasa muncul begitu saja.",
    "Ajakan disampaikan, tapi terdengar dibaca dari skrip dan tidak dihubungkan ke apa pun yang baru terjadi di video.",
    "Ajakan disampaikan dengan jelas dan terhubung ke isi video sebelumnya, tapi penyampaiannya datar — nada suara atau visual tidak menekankan urgensi.",
    "Ajakan disampaikan dengan jelas, terasa termotivasi oleh momen yang baru terjadi di video, dan nada penyampaiannya meyakinkan.",
    "Ajakan terasa seperti kelanjutan alami dari momen sebelumnya, disampaikan dengan nada percaya diri dan didukung visual atau teks yang menegaskannya tanpa terasa dipaksakan.",
  ],
  messageClarity: [
    "Video memuat lebih dari satu ide utama yang bersaing tanpa ada yang ditekankan, sehingga penonton sulit menyebutkan satu takeaway tunggal.",
    "Ada satu ide utama yang bisa ditebak, tapi tertutup oleh detail atau tangen yang tidak mendukung ide tersebut.",
    "Ide utama bisa diidentifikasi dengan jelas, meski beberapa bagian video melebar ke detail yang tidak esensial bagi ide itu.",
    "Satu ide utama disampaikan secara konsisten dari awal sampai akhir, dengan detail pendukung yang relevan terhadap ide tersebut.",
    "Satu takeaway tunggal disampaikan secara eksplisit dan diperkuat berulang kali (lewat kata-kata, teks di layar, dan visual) tanpa ada tangen yang mengaburkannya.",
  ],
  originality: [
    "Format, hook, dan eksekusi meniru pola yang sudah sangat umum tanpa variasi apa pun yang membedakannya dari video sejenis lainnya.",
    "Ada sedikit variasi dari format umum, tapi eksekusinya masih terasa generik dan mudah ditebak sejak awal.",
    "Format yang digunakan familiar, namun ada satu elemen (sudut pandang, framing, atau twist) yang membedakannya dari video sejenis.",
    "Eksekusi menggabungkan format yang dikenal dengan sudut pandang atau detail spesifik kreator, sehingga video terasa punya identitas sendiri.",
    "Pendekatan, sudut pandang, atau twist yang digunakan jarang terlihat pada format sejenis, memberi kesan video ini tidak mudah ditiru dengan template umum.",
  ],
  emotionalResonance: [
    "Video tidak memicu reaksi emosional yang bisa diidentifikasi; nada dan isi terasa datar sepanjang durasi.",
    "Ada momen yang berusaha memicu emosi, tapi terasa dipaksakan atau tidak didukung konteks yang cukup untuk benar-benar terasa.",
    "Video memicu satu momen emosional yang terasa, tapi bagian video lainnya tidak mendukung atau melanjutkan momen itu.",
    "Video membangun emosi (kedekatan, kejutan, kelegaan) secara konsisten sehingga penonton terasa terhubung, meski intensitasnya sedang.",
    "Video menciptakan momen emosional yang mendorong keinginan untuk menyimpan atau membagikan, dengan bangunan emosi yang terasa sejak awal dan memuncak di titik tertentu.",
  ],
};
