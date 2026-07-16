export type AnalysisListItem = {
  id: string;
  prompt: string | null;
  status: "pending" | "completed" | "failed";
  url: string;
  platform: "instagram" | "youtube";
  mediaType: "reel" | "post" | "carousel" | "short";
  username: string;
  overallScore: number | null;
  scorecard: Scorecard | null;
  thumbnailUrl: string | null;
  viewCount: number | null;
  postDate: string | null;
  durationSec: number | null;
  caption: string | null;
  title: string | null;
  createdAt: string;
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
  strengths: string[];
  weaknesses: string[];
  keyMoments: string[];
  scorecard: Scorecard;
  patterns: Patterns;
  suggestions: string[];
};

export type AnalysisDetail = {
  id: string;
  prompt: string | null;
  status: "pending" | "completed" | "failed";
  title: string | null;
  url: string;
  platform: "instagram" | "youtube";
  mediaType: "reel" | "post" | "carousel" | "short";
  username: string;
  thumbnailUrl: string | null;
  viewCount: number | null;
  postDate: string | null;
  caption: string | null;
  durationSec: number | null;
  results: ContentAnalysis | null;
  createdAt: string;
};

export type AnalysesListResponse = {
  analyses: AnalysisListItem[];
  accounts: string[];
};

export type AnalyzeResponse = {
  analysisIds: string[];
  analysesCreated: number;
  failedUrls: { url: string; index: number; error: string }[];
  error?: string;
};

export type DeleteResponse = { success: true };
