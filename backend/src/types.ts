import type { StructuredToolInterface } from "@langchain/core/tools";
import type { DataModel } from "cau-context-surfaces";
import type { MemoryType } from "cau-ram";

import type { DetectedTopicStatus, DetectedTopicSource } from "./constants";

type McpToolDef = {
  name: string;
  description: string;
};

// --- Dataset Config (matches dataset.config.json schema) ---

type RoleConfig = {
  label: string;
  shortLabel: string;
};

type ParticipantConfig = {
  name: string;
  title: string;
  organization: string;
};

type MemoryTypeLabel = {
  label: string;
  description: string;
};

type DatasetConfig = {
  id: string;
  name: string;
  description: string;
  userId: string;
  branding: {
    title: string;
    subtitle: string;
    footerText: string;
    accentColor: string;
  };
  roles: Record<string, RoleConfig>;
  roleMapping: Record<string, "user" | "assistant">;
  participants: Record<string, ParticipantConfig>;
  memoryLabels: {
    workingMemory: {
      title: string;
      description: string;
      contextSummaryLabel: string;
    };
    longTermMemory: {
      title: string;
      description: string;
      semantic: MemoryTypeLabel;
      episodic: MemoryTypeLabel;
      message: MemoryTypeLabel;
    };
    metrics: {
      title: string;
      description: string;
    };
  };
  suggestions?: SuggestionsConfig;
  contextSurfaces?: ContextSurfacesDatasetConfig;
  transcriptPanel: {
    title: string;
    playingLabel: string;
    completedLabel: string;
  };
  toolbar: {
    transcriptDropdownLabel: string;
    playLabel: string;
    pauseLabel: string;
    nextLabel: string;
    resetLabel: string;
    speedLabel: string;
  };
  statusLabels: Record<string, string>;
  playbackDefaults: {
    intervalMs: number;
    speeds: Array<{ label: string; intervalMs: number }>;
  };
};

type DatasetSummary = {
  id: string;
  name: string;
};

// --- Transcript ---

type TranscriptChunk = {
  timestamp: string;
  speaker: string;
  role: string;
  text: string;
};

type TranscriptMeeting = {
  id: string;
  date: string;
  type: string;
  durationMinutes: number;
  participants: Record<string, string>;
  summary: {
    topics: string[];
    sentiment: string;
    keyDecisions: string[];
    followUps: string[];
  };
};

type TranscriptData = {
  meeting: TranscriptMeeting;
  chunks: TranscriptChunk[];
};

type TranscriptSummary = {
  id: string;
  date: string;
  type: string;
  durationMinutes: number;
  chunkCount: number;
  participants: Record<string, string>;
};

// --- Request types ---

type GetTranscriptInput = {
  transcriptId: string;
};

type CreateWorkingMemoryInput = {
  transcriptId: string;
};

type AppendWorkingMemoryInput = {
  sessionId: string;
  chunk: TranscriptChunk;
  isLastChunk: boolean;
};

type GetWorkingMemoryInput = {
  sessionId: string;
};

type DeleteWorkingMemoryInput = {
  sessionId: string;
};

type ListWorkingMemorySessionsInput = {
  limit?: number;
  pageToken?: string;
};

type SearchLongTermMemoryInput = {
  text?: string;
  memoryType?: MemoryType;
  topics?: string[];
  limit?: number;
  offset?: number;
};

type SearchLongTermMemoryBySessionInput = {
  sessionId: string;
};

// --- Suggestions ---

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

type TopicUpdate = {
  name: string;
  status: DetectedTopicStatus;
  detectedAtTimestamp: string | null;
};

type SuggestionLlmResponse = {
  suggestion: {
    type: string;
    title: string;
    summary: string;
    details: string[];
    relatedTopics: string[];
  } | null;
  topicUpdates: TopicUpdate[];
};

type GenerateSuggestionInput = {
  sessionId: string;
  chunkIndex: number;
};

type GenerateSuggestionResult = {
  suggestion: Suggestion | null;
  detectedTopics: DetectedTopic[];
};

type ListSuggestionsInput = {
  sessionId: string;
};

// --- CopilotKit (LangGraph state) ---

type CopilotKitReadable = { description: string; value: string };

type CopilotKitState = {
  context?: CopilotKitReadable[];
  actions?: unknown[];
};

// --- Context Surfaces (dataset config) ---

type ContextSurfacesDatasetConfig = {
  surfaceName: string;
  clientDataFile: string;
};

// --- Context Surfaces setup ---

type ClientDataFile = {
  dataModel: DataModel;
  records: Record<string, Record<string, unknown>[]>;
};

type ParsedRedisUrl = {
  addr: string;
  username: string;
  password: string;
  tls: boolean;
  db: number;
};

type SetupResult = {
  surfaceId: string;
  agentKey: string;
};

// --- App state (set at startup, read by handlers) ---

type AppState = {
  datasetConfig: DatasetConfig | null;
  userId: string;
  ctxSurfaceId: string;
  mcpAgentKey: string;
};

type ContextSurfacesResult = {
  tools: StructuredToolInterface[];
  mcpToolDefs: McpToolDef[];
};

export type {
  RoleConfig,
  ParticipantConfig,
  MemoryTypeLabel,
  ContextSurfacesDatasetConfig,
  DatasetConfig,
  DatasetSummary,
  SuggestionTypeConfig,
  SuggestionsConfig,
  TopicMention,
  DetectedTopic,
  Suggestion,
  TopicUpdate,
  SuggestionLlmResponse,
  GenerateSuggestionInput,
  GenerateSuggestionResult,
  ListSuggestionsInput,
  CopilotKitReadable,
  CopilotKitState,
  TranscriptChunk,
  TranscriptMeeting,
  TranscriptData,
  TranscriptSummary,
  GetTranscriptInput,
  CreateWorkingMemoryInput,
  AppendWorkingMemoryInput,
  GetWorkingMemoryInput,
  DeleteWorkingMemoryInput,
  ListWorkingMemorySessionsInput,
  SearchLongTermMemoryInput,
  SearchLongTermMemoryBySessionInput,
  ClientDataFile,
  ParsedRedisUrl,
  SetupResult,
  AppState,
  ContextSurfacesResult,
  McpToolDef,
};
