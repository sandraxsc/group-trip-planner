/** Payload sent to POST /api/openai/vote-gap-fill */

export interface VoteGapReportPayload {
  slotsNeeded: number;
  hasDiversityGap: boolean;
  missingPreferenceActivityIds: string[];
  /** Plain-language gaps for the model */
  statedGaps: string[];
  budgetFloor: string;
  destination: string;
}

export interface VoteGapFillExistingCandidate {
  name: string;
  placeId: string;
}

export interface VoteGapFillProfilePayload {
  destination: string;
  commonActiveHours: { start: string; end: string };
  groupEnergyLevel: string;
  groupBudgetLevel: string;
  excludedTags: string[];
  commonActivityTypes: string[];
  candidatePlaceHints: string[];
}

export interface VoteGapFillRequest {
  gapReport: VoteGapReportPayload;
  profile: VoteGapFillProfilePayload;
  existingCandidates: VoteGapFillExistingCandidate[];
  recommendationCount: number;
}

export interface VoteGapRecommendation {
  name: string;
  searchQuery: string;
  reason: string;
  fillsGap: string;
  upgradeNote: string | null;
}

export interface VoteGapFillResponse {
  recommendations: VoteGapRecommendation[];
}

export interface VoteGapReplacementRequest {
  destination: string;
  failedSuggestion: { name: string; searchQuery: string };
  excludedTags: string[];
  statedGaps: string[];
  budgetFloor: string;
  commonActivityTypes: string[];
  groupEnergyLevel: string;
  existingCandidateNames: string[];
}

export interface VoteGapReplacementResponse {
  recommendation: VoteGapRecommendation | null;
}
