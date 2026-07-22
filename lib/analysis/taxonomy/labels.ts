import type {
  BeatType,
  CtaTiming,
  CtaType,
  FormatArchetype,
  HookType,
  Pacing,
  TopicNiche,
} from "./types";

/**
 * Indonesian labels for the taxonomy identifiers (PRD §4.2).
 *
 * The enum identifiers on the wire stay English and machine-stable; these are
 * the human-readable Indonesian renderings, for analysis/brief output and for
 * anywhere a taxonomy value is shown to an Indonesian-speaking user. The app
 * chrome itself stays English (PRD §1) — these labels do NOT relabel the UI.
 *
 * Every record is exhaustive (`Record<Union, string>`), so a new enum value
 * added to `types.ts` cannot ship without a label.
 */

export const TOPIC_NICHE_LABELS: Record<TopicNiche, string> = {
  FOOD_CULINARY: "Kuliner & Makanan",
  BEAUTY_SKINCARE: "Kecantikan & Perawatan Kulit",
  FASHION_STYLE: "Fashion & Gaya Berpakaian",
  HEALTH_FITNESS: "Kesehatan & Kebugaran",
  FINANCE_INVESTING: "Keuangan & Investasi",
  BUSINESS_ENTREPRENEURSHIP: "Bisnis & Kewirausahaan",
  EDUCATION_SKILLS: "Edukasi & Pengembangan Skill",
  TECH_GADGETS: "Teknologi & Gadget",
  PARENTING_FAMILY: "Parenting & Keluarga",
  RELIGION_SPIRITUALITY: "Agama & Spiritualitas",
  TRAVEL: "Traveling & Wisata",
  COMEDY_ENTERTAINMENT: "Komedi & Hiburan",
  LIFESTYLE_DAILY: "Gaya Hidup Sehari-hari",
  HOME_INTERIOR: "Rumah & Interior",
  AUTOMOTIVE: "Otomotif",
  GAMING: "Gaming",
  RELATIONSHIPS: "Hubungan & Percintaan",
  OTHER: "Lainnya",
};

export const HOOK_TYPE_LABELS: Record<HookType, string> = {
  DIRECT_VALUE_PROMISE: "Janji Manfaat Langsung",
  NUMBERED_LIST: "Daftar Berangka",
  CURIOSITY_QUESTION: "Pertanyaan Pemancing Penasaran",
  SIDE_BY_SIDE_COMPARISON: "Perbandingan Berdampingan",
  MYTH_CORRECTION: "Koreksi Mitos",
  WARNING_MISTAKE: "Peringatan Kesalahan",
  CONTRARIAN_OPINION: "Opini Berlawanan Arus",
  SECRET_INSIDER_REVEAL: "Bocoran Rahasia Orang Dalam",
  RESULT_PROOF: "Bukti Hasil",
  PERSONAL_STORY_OPENER: "Pembuka Cerita Pribadi",
  PROCESS_JOURNEY_SERIES: "Proses / Perjalanan Berseri",
  VISUAL_DEMONSTRATION: "Demonstrasi Visual",
  SHOCK_STATEMENT: "Pernyataan Mengejutkan",
  RELATABLE_PAIN_POINT: "Keresahan yang Relatable",
  EXPERIMENT_CHALLENGE: "Eksperimen / Tantangan",
  TEXT_OVERLAY_ONLY: "Teks di Layar Saja",
  COLD_OPEN_ACTION: "Pembuka Aksi Tanpa Narasi",
  OTHER: "Lainnya",
};

export const FORMAT_ARCHETYPE_LABELS: Record<FormatArchetype, string> = {
  TALKING_HEAD: "Bicara Langsung ke Kamera",
  VOICEOVER_BROLL: "Voice Over dengan B-Roll",
  POV_SKIT: "Skit POV",
  TUTORIAL_DEMO: "Tutorial & Demo",
  PRODUCT_REVIEW: "Review Produk",
  TRANSFORMATION_REVEAL: "Transformasi Sebelum-Sesudah",
  GREEN_SCREEN_COMMENTARY: "Komentar Green Screen",
  REACTION_STITCH: "Reaksi / Stitch",
  INTERVIEW_STREET: "Wawancara / Street Interview",
  TEXT_SLIDESHOW: "Slideshow Teks",
  VLOG_DAILY: "Vlog Keseharian",
  PROCESS_ASMR: "Proses / ASMR",
  PERFORMANCE: "Performa (Dance, Lip-sync, Musik)",
  CAROUSEL_STATIC: "Carousel Foto Statis",
  OTHER: "Lainnya",
};

export const CTA_TYPE_LABELS: Record<CtaType, string> = {
  FOLLOW: "Ajakan Follow",
  COMMENT_PROMPT: "Ajakan Berkomentar",
  SAVE_PROMPT: "Ajakan Menyimpan",
  SHARE_PROMPT: "Ajakan Membagikan",
  LINK_IN_BIO: "Arahkan ke Link di Bio",
  SHOP_PURCHASE: "Ajakan Belanja / Checkout",
  DM_INQUIRY: "Ajakan DM / Chat Admin",
  JOIN_COMMUNITY: "Ajakan Gabung Komunitas",
  SIGN_UP_REGISTER: "Ajakan Mendaftar",
  WATCH_NEXT: "Ajakan Nonton Lanjutan",
  DISCOUNT_CODE: "Ajakan Pakai Kode Diskon",
  NONE: "Tanpa Ajakan",
  OTHER: "Lainnya",
};

export const CTA_TIMING_LABELS: Record<CtaTiming, string> = {
  EARLY: "Di Awal",
  MID: "Di Tengah",
  END: "Di Akhir",
  NONE: "Tidak Ada",
};

export const BEAT_TYPE_LABELS: Record<BeatType, string> = {
  HOOK: "Hook",
  SETUP: "Penyiapan Konteks",
  BODY_PROOF: "Isi & Bukti",
  TWIST: "Twist",
  RESOLUTION: "Penutup & Kesimpulan",
  CTA: "Ajakan Bertindak",
};

export const PACING_LABELS: Record<Pacing, string> = {
  SLOW: "Lambat",
  MEDIUM: "Sedang",
  FAST: "Cepat",
  MIXED: "Campuran",
};
