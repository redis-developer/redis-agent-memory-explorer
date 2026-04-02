import type { DetectedTopicStatus, DetectedTopicSource } from "@/constants/app.constants";

type SuggestionTypeConfig = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};

type LiveSuggestionsConfig = {
  title: string;
  description: string;
  bannerLabel: string;
  topicsTitle: string;
  insightsTitle: string;
  waitingMessage: string;
  noSuggestionsMessage: string;
  triggerEveryNChunks: number;
  suggestionTypes: SuggestionTypeConfig[];
};

type DetectedTopic = {
  name: string;
  status: DetectedTopicStatus;
  detectedAtChunkIndex: number | null;
  detectedAtTimestamp: string | null;
  source: DetectedTopicSource;
};

type LiveSuggestion = {
  id: string;
  type: string;
  title: string;
  summary: string;
  details: string[];
  chunkIndex: number;
  timestamp: string;
  relatedTopics: string[];
  createdAt: string;
};

type GenerateSuggestionResponse = {
  suggestion: LiveSuggestion | null;
  detectedTopics: DetectedTopic[];
};

type ListSuggestionsResponse = {
  suggestions: LiveSuggestion[];
  detectedTopics: DetectedTopic[];
  total: number;
};

export type {
  SuggestionTypeConfig,
  LiveSuggestionsConfig,
  DetectedTopic,
  LiveSuggestion,
  GenerateSuggestionResponse,
  ListSuggestionsResponse,
};
