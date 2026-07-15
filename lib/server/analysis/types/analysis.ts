export interface ContentItemAnalysis {
  url: string;
  mediaType: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  keyMoments: string[];
}

export interface Scorecard {
  hookStrength: number;
  retentionFlow: number;
  visualPolish: number;
  audioVisualSync: number;
  trendAlignment: number;
  callToAction: number;
  brandConsistency: number;
}

export interface Patterns {
  viralFormulas: string[];
  audiencePsychology: string[];
  recurringRedFlags: string[];
}

export interface ContentAnalysis {
  overallScore: number;
  summary: string;
  perItem: ContentItemAnalysis[];
  scorecard: Scorecard;
  patterns: Patterns;
  suggestions: string[];
}

export interface AnalyzeResult {
  analysisId: string;
  itemsAnalyzed: number;
  failedItems: { url: string; index: number; error: string }[];
  content: ContentAnalysis;
  rawGemini: string;
}
