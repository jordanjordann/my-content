// Structured-output behavioural baseline, ported from the legacy
// @google/generative-ai harness to @google/genai (ticket #75).
//
// Same model, same schema, same prompt, same generation config as the legacy
// version — the point is to show the new SDK reproduces the old results, not to
// re-prove that the contract is expressible.
//
// Run: GEMINI_API_KEY=... node .claude/context/fixtures/gemini/structured-output-baseline.mjs
// This DOES make a live billed call. Do not run it casually.
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const HOOK_TYPES = [
  "CONTRARIAN_OPINION","CURIOSITY_GAP","BOLD_CLAIM","NUMBERED_LIST","PERSONAL_STORY_OPENER",
  "PROBLEM_AGITATION","SHOCKING_STAT","DIRECT_QUESTION","BEFORE_AFTER_TEASE","POV_STATEMENT",
  "MYTH_BUSTING","WARNING_ALERT","RELATABLE_SCENARIO","TUTORIAL_PROMISE","COMPARISON_SETUP",
  "CLIFFHANGER","CALLOUT_DIRECT_ADDRESS","OTHER",
];

const FORMAT_ARCHETYPES = [
  "TALKING_HEAD","VOICEOVER_BROLL","SCREEN_RECORDING","TEXT_ON_SCREEN_MONTAGE","INTERVIEW",
  "SKIT_ACTED","VLOG_STYLE","BEFORE_AFTER_DEMO","TUTORIAL_STEP_BY_STEP","LISTICLE_OVERLAY",
  "REACTION_COMMENTARY","SLIDESHOW_CAROUSEL_STYLE","SPLIT_SCREEN_DUET","STORYTIME_NARRATION","OTHER",
];

const TOPIC_NICHES = [
  "BEAUTY_SKINCARE","FASHION","FITNESS_HEALTH","FOOD_COOKING","FINANCE_MONEY","EDUCATION_STUDY",
  "TECH_GADGETS","TRAVEL","PARENTING_FAMILY","RELATIONSHIP_DATING","CAREER_BUSINESS","ENTERTAINMENT_POP_CULTURE",
  "COMEDY_HUMOR","LIFESTYLE_VLOG","HOME_DECOR","AUTOMOTIVE","GAMING","SPIRITUALITY_RELIGION","OTHER",
];

const CTA_TYPES = [
  "FOLLOW","LIKE","COMMENT","SHARE","SAVE","SHOP_PURCHASE","JOIN_COMMUNITY","CLICK_LINK",
  "DOWNLOAD_APP","SIGN_UP","WATCH_MORE","NONE","OTHER",
];

const schema = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.INTEGER, description: "1-5" },
    summary: { type: Type.STRING, description: "Free text Indonesian prose" },
    topicNiche: { type: Type.STRING, format: "enum", enum: TOPIC_NICHES },
    topicSubtopic: { type: Type.STRING, description: "Free text Indonesian" },
    formatArchetype: { type: Type.STRING, format: "enum", enum: FORMAT_ARCHETYPES },
    hookType: { type: Type.STRING, format: "enum", enum: HOOK_TYPES },
    hookTypeSecondary: {
      type: Type.STRING,
      format: "enum",
      enum: HOOK_TYPES,
      nullable: true,
    },
    // Nullable numeric probe (step 5 of #75) — the legacy harness only proved
    // nullable on an enum-typed string.
    durationSeconds: { type: Type.NUMBER, nullable: true },
    hasAudienceCallout: { type: Type.BOOLEAN },
    ctaType: {
      type: Type.ARRAY,
      items: { type: Type.STRING, format: "enum", enum: CTA_TYPES },
    },
    ctaTiming: {
      type: Type.STRING,
      format: "enum",
      enum: ["EARLY", "MID", "END", "NONE"],
    },
    scorecard: {
      type: Type.OBJECT,
      properties: {
        hookStrength: { type: Type.INTEGER },
        pacing: { type: Type.INTEGER },
        visualPolish: { type: Type.INTEGER },
        audioQuality: { type: Type.INTEGER },
        ctaEffectiveness: { type: Type.INTEGER },
        emotionalResonance: { type: Type.INTEGER },
        clarityOfMessage: { type: Type.INTEGER },
      },
      required: [
        "hookStrength", "pacing", "visualPolish", "audioQuality",
        "ctaEffectiveness", "emotionalResonance", "clarityOfMessage",
      ],
    },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  // Supported on @google/genai's Schema (absent from the legacy Schema type).
  propertyOrdering: [
    "overallScore", "summary", "topicNiche", "topicSubtopic", "formatArchetype",
    "hookType", "hookTypeSecondary", "durationSeconds", "hasAudienceCallout",
    "ctaType", "ctaTiming", "scorecard", "strengths",
  ],
  required: [
    "overallScore", "summary", "topicNiche", "topicSubtopic", "formatArchetype",
    "hookType", "hasAudienceCallout", "ctaType", "ctaTiming", "scorecard", "strengths",
  ],
};

const prompt = `Analisis video pendek berikut secara hipotetis (tidak ada video nyata, buat contoh realistis dalam Bahasa Indonesia untuk field teks bebas): sebuah video TikTok tentang tips keuangan pribadi, dibuka dengan pertanyaan provokatif, lalu daftar bernomor, diakhiri ajakan follow dan join grup WA. Isi semua field sesuai skema JSON yang diberikan.`;

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    temperature: 0.2,
    maxOutputTokens: 32768,
    responseMimeType: "application/json",
    responseSchema: schema,
  },
});

console.log("=== finishReason ===");
console.log(response.candidates?.[0]?.finishReason);

console.log("=== usageMetadata ===");
console.log(JSON.stringify(response.usageMetadata, null, 2));

// `text` is a PROPERTY here, not a method as on the legacy SDK.
const text = response.text;
console.log("=== typeof text ===", typeof text);
console.log("=== raw text length ===", text?.length);
console.log("=== raw text ===");
console.log(text);

try {
  const parsed = JSON.parse(text);
  console.log("=== PARSED OK ===");
  console.log(JSON.stringify(parsed, null, 2));
} catch (e) {
  console.log("=== PARSE FAILED ===", e.message);
}
