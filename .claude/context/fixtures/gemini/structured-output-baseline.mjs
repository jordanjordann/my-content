import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
  type: SchemaType.OBJECT,
  properties: {
    overallScore: { type: SchemaType.INTEGER, description: "1-5" },
    summary: { type: SchemaType.STRING, description: "Free text Indonesian prose" },
    topicNiche: { type: SchemaType.STRING, format: "enum", enum: TOPIC_NICHES },
    topicSubtopic: { type: SchemaType.STRING, description: "Free text Indonesian" },
    formatArchetype: { type: SchemaType.STRING, format: "enum", enum: FORMAT_ARCHETYPES },
    hookType: { type: SchemaType.STRING, format: "enum", enum: HOOK_TYPES },
    hookTypeSecondary: {
      type: SchemaType.STRING,
      format: "enum",
      enum: HOOK_TYPES,
      nullable: true,
    },
    hasAudienceCallout: { type: SchemaType.BOOLEAN },
    ctaType: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING, format: "enum", enum: CTA_TYPES },
    },
    ctaTiming: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["EARLY", "MID", "END", "NONE"],
    },
    scorecard: {
      type: SchemaType.OBJECT,
      properties: {
        hookStrength: { type: SchemaType.INTEGER },
        pacing: { type: SchemaType.INTEGER },
        visualPolish: { type: SchemaType.INTEGER },
        audioQuality: { type: SchemaType.INTEGER },
        ctaEffectiveness: { type: SchemaType.INTEGER },
        emotionalResonance: { type: SchemaType.INTEGER },
        clarityOfMessage: { type: SchemaType.INTEGER },
      },
      required: [
        "hookStrength", "pacing", "visualPolish", "audioQuality",
        "ctaEffectiveness", "emotionalResonance", "clarityOfMessage",
      ],
    },
    strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: [
    "overallScore", "summary", "topicNiche", "topicSubtopic", "formatArchetype",
    "hookType", "hasAudienceCallout", "ctaType", "ctaTiming", "scorecard", "strengths",
  ],
};

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 32768,
    responseMimeType: "application/json",
    responseSchema: schema,
  },
});

const prompt = `Analisis video pendek berikut secara hipotetis (tidak ada video nyata, buat contoh realistis dalam Bahasa Indonesia untuk field teks bebas): sebuah video TikTok tentang tips keuangan pribadi, dibuka dengan pertanyaan provokatif, lalu daftar bernomor, diakhiri ajakan follow dan join grup WA. Isi semua field sesuai skema JSON yang diberikan.`;

const result = await model.generateContent(prompt);
const response = result.response;

console.log("=== finishReason ===");
console.log(response.candidates?.[0]?.finishReason);

console.log("=== usageMetadata ===");
console.log(JSON.stringify(response.usageMetadata, null, 2));

const text = response.text();
console.log("=== raw text length ===", text.length);
console.log("=== raw text ===");
console.log(text);

try {
  const parsed = JSON.parse(text);
  console.log("=== PARSED OK ===");
  console.log(JSON.stringify(parsed, null, 2));
} catch (e) {
  console.log("=== PARSE FAILED ===", e.message);
}
