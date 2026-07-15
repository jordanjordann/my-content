export type AnalysisListItem = {
  id: string;
  prompt: string | null;
  status: "pending" | "completed" | "failed";
  itemCount: number;
  platforms: ("instagram" | "youtube")[];
  overallScore: number | null;
  createdAt: string;
};

export type ContentItemRecord = {
  id: string;
  url: string;
  platform: "instagram" | "youtube";
  mediaType: "reel" | "post" | "carousel" | "short";
  username: string;
  thumbnailUrl: string | null;
  viewCount: number | null;
  postDate: string | null;
  caption: string | null;
  durationSec: number | null;
};

export type ContentItemAnalysis = {
  url: string;
  mediaType: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  keyMoments: string[];
};

export type Scorecard = {
  hookStrength: number;
  retentionFlow: number;
  visualPolish: number;
  audioVisualSync: number;
  trendAlignment: number;
  callToAction: number;
  brandConsistency: number;
};

export type Patterns = {
  viralFormulas: string[];
  audiencePsychology: string[];
  recurringRedFlags: string[];
};

export type ContentAnalysis = {
  overallScore: number;
  summary: string;
  perItem: ContentItemAnalysis[];
  scorecard: Scorecard;
  patterns: Patterns;
  suggestions: string[];
};

export type AnalysisDetail = {
  id: string;
  prompt: string | null;
  status: string;
  items: ContentItemRecord[];
  results: ContentAnalysis | null;
  createdAt: string;
};

export type AnalysesListResponse = {
  analyses: AnalysisListItem[];
  accounts: string[];
};

export type AnalyzeResponse = {
  analysisId: string;
  itemsAnalyzed: number;
  failedItems: { url: string; index: number; error: string }[];
  error?: string;
};

export type DeleteResponse = { success: true };
