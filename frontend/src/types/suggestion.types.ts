import type { DetectedTopicStatus, DetectedTopicSource } from "@/constants/app.constants";

type SuggestionTypeConfig = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};

type SuggestionsConfig = {
  title: string;
  description: string;
  bannerLabel: string;
  topicsTitle: string;
  topicsEmptyTitle: string;
  topicsEmptyDescription: string;
  insightsTitle: string;
  waitingMessage: string;
  noSuggestionsMessage: string;
  triggerEveryNChunks: number;
  suggestionTypes: SuggestionTypeConfig[];
};

type TopicMention = {
  chunkIndex: number;
  timestamp: string | null;
  status: DetectedTopicStatus;
};

type DetectedTopic = {
  name: string;
  status: DetectedTopicStatus;
  detectedAtChunkIndex: number | null;
  detectedAtTimestamp: string | null;
  source: DetectedTopicSource;
  history: TopicMention[];
};

type Suggestion = {
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
  suggestion: Suggestion | null;
  detectedTopics: DetectedTopic[];
};

type ListSuggestionsResponse = {
  suggestions: Suggestion[];
  detectedTopics: DetectedTopic[];
  total: number;
};

export type {
  SuggestionTypeConfig,
  SuggestionsConfig,
  TopicMention,
  DetectedTopic,
  Suggestion,
  GenerateSuggestionResponse,
  ListSuggestionsResponse,
};
