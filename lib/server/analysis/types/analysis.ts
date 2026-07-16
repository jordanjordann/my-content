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
  strengths: string[];
  weaknesses: string[];
  keyMoments: string[];
  scorecard: Scorecard;
  patterns: Patterns;
  suggestions: string[];
}

export interface AnalyzeResult {
  analysisId: string;
  content: ContentAnalysis;
  rawGemini: string;
}
