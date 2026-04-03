import type { DatasetConfig } from "@/types/dataset-config.types";
import type {
  TranscriptData,
  TranscriptSummary,
  TranscriptChunk,
} from "@/types/transcript.types";
import type {
  WorkingMemoryData,
  AppendResult,
  CreateSessionResponse,
  SummaryViewData,
  ComputedSummaryData,
} from "@/types/memory.types";
import type {
  ApiResponse,
  HealthResponse,
  ListSessionsResponse,
  LtSearchResponse,
  ResetResult,
} from "@/types/api.types";
import type {
  GenerateSuggestionResponse,
  ListSuggestionsResponse,
} from "@/types/suggestion.types";

import { API_BASE_URL } from "@/constants/app.constants";

const API_PATH = {
  GET_DATASET: "/api/getDataset",
  LIST_TRANSCRIPTS: "/api/listTranscripts",
  GET_TRANSCRIPT: "/api/getTranscript",
  CREATE_WORKING_MEMORY: "/api/createWorkingMemory",
  APPEND_WORKING_MEMORY: "/api/appendWorkingMemory",
  GET_WORKING_MEMORY: "/api/getWorkingMemory",
  DELETE_WORKING_MEMORY: "/api/deleteWorkingMemory",
  LIST_WORKING_MEMORY_SESSIONS: "/api/listWorkingMemorySessions",
  SEARCH_LONG_TERM_MEMORY: "/api/searchLongTermMemory",
  SEARCH_LONG_TERM_MEMORY_BY_SESSION: "/api/searchLongTermMemoryBySession",
  CREATE_SUMMARY_VIEW: "/api/createSummaryView",
  LIST_SUMMARY_VIEWS: "/api/listSummaryViews",
  COMPUTE_SUMMARY: "/api/computeSummary",
  GET_COMPUTED_SUMMARIES: "/api/getComputedSummaries",
  DELETE_SUMMARY_VIEW: "/api/deleteSummaryView",
  GET_TASK: "/api/getTask",
  GENERATE_SUGGESTION: "/api/generateSuggestion",
  LIST_SUGGESTIONS: "/api/listSuggestions",
  RESET_LIFECYCLE: "/api/resetLifecycle",
  HEALTH: "/health",
} as const;

const apiPost = async <T>(path: string, body: unknown = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: ApiResponse<T> = await response.json();
  if (json.error) {
    throw new Error(json.error);
  }
  return json.data as T;
};

const apiGet = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

const fetchDatasetConfig = (): Promise<DatasetConfig> =>
  apiPost<DatasetConfig>(API_PATH.GET_DATASET);

const fetchTranscripts = (): Promise<{ transcripts: TranscriptSummary[] }> =>
  apiPost<{ transcripts: TranscriptSummary[] }>(API_PATH.LIST_TRANSCRIPTS);

const fetchTranscript = (transcriptId: string): Promise<TranscriptData> =>
  apiPost<TranscriptData>(API_PATH.GET_TRANSCRIPT, { transcriptId });

const createWorkingMemory = (
  transcriptId: string,
): Promise<CreateSessionResponse> =>
  apiPost<CreateSessionResponse>(API_PATH.CREATE_WORKING_MEMORY, {
    transcriptId,
  });

const appendChunk = (
  sessionId: string,
  chunk: TranscriptChunk,
  isLastChunk: boolean,
): Promise<AppendResult> =>
  apiPost<AppendResult>(API_PATH.APPEND_WORKING_MEMORY, {
    sessionId,
    chunk,
    isLastChunk,
  });

const fetchWorkingMemory = (sessionId: string): Promise<WorkingMemoryData> =>
  apiPost<WorkingMemoryData>(API_PATH.GET_WORKING_MEMORY, { sessionId });

const deleteWorkingMemory = (sessionId: string): Promise<void> =>
  apiPost<void>(API_PATH.DELETE_WORKING_MEMORY, { sessionId });

const listWorkingMemorySessions = (
  limit?: number,
  offset?: number,
): Promise<ListSessionsResponse> =>
  apiPost<ListSessionsResponse>(API_PATH.LIST_WORKING_MEMORY_SESSIONS, {
    limit,
    offset,
  });

const searchLongTermMemory = (params: {
  text?: string;
  memoryType?: string;
  topics?: string[];
  entities?: string[];
  limit?: number;
  offset?: number;
}): Promise<LtSearchResponse> =>
  apiPost<LtSearchResponse>(API_PATH.SEARCH_LONG_TERM_MEMORY, params);

const searchLongTermMemoryBySession = (
  sessionId: string,
): Promise<LtSearchResponse> =>
  apiPost<LtSearchResponse>(API_PATH.SEARCH_LONG_TERM_MEMORY_BY_SESSION, {
    sessionId,
  });

const createSummaryView = (input: {
  name?: string;
  source: string;
  groupBy?: string[];
  timeWindowDays?: number;
}): Promise<SummaryViewData> =>
  apiPost<SummaryViewData>(API_PATH.CREATE_SUMMARY_VIEW, input);

const listSummaryViews = (): Promise<{ views: SummaryViewData[] }> =>
  apiPost<{ views: SummaryViewData[] }>(API_PATH.LIST_SUMMARY_VIEWS);

const computeSummary = (
  viewId: string,
  group: Record<string, string>,
): Promise<ComputedSummaryData & { viewId: string }> =>
  apiPost<ComputedSummaryData & { viewId: string }>(API_PATH.COMPUTE_SUMMARY, {
    viewId,
    group,
  });

const fetchComputedSummaries = (
  viewId: string,
): Promise<{ summaries: ComputedSummaryData[] }> =>
  apiPost<{ summaries: ComputedSummaryData[] }>(
    API_PATH.GET_COMPUTED_SUMMARIES,
    { viewId },
  );

const deleteSummaryView = (viewId: string): Promise<void> =>
  apiPost<void>(API_PATH.DELETE_SUMMARY_VIEW, { viewId });

const fetchTask = (
  taskId: string,
): Promise<{ id: string; status: string; result: unknown }> =>
  apiPost<{ id: string; status: string; result: unknown }>(API_PATH.GET_TASK, {
    taskId,
  });

const generateSuggestion = (
  sessionId: string,
  chunkIndex: number,
): Promise<GenerateSuggestionResponse> =>
  apiPost<GenerateSuggestionResponse>(API_PATH.GENERATE_SUGGESTION, {
    sessionId,
    chunkIndex,
  });

const listSuggestions = (
  sessionId: string,
): Promise<ListSuggestionsResponse> =>
  apiPost<ListSuggestionsResponse>(API_PATH.LIST_SUGGESTIONS, { sessionId });

const resetDemo = (): Promise<ResetResult> =>
  apiPost<ResetResult>(API_PATH.RESET_LIFECYCLE);

const fetchHealth = (): Promise<HealthResponse> =>
  apiGet<HealthResponse>(API_PATH.HEALTH);

export {
  apiPost,
  apiGet,
  fetchDatasetConfig,
  fetchTranscripts,
  fetchTranscript,
  createWorkingMemory,
  appendChunk,
  fetchWorkingMemory,
  deleteWorkingMemory,
  listWorkingMemorySessions,
  searchLongTermMemory,
  searchLongTermMemoryBySession,
  createSummaryView,
  listSummaryViews,
  computeSummary,
  fetchComputedSummaries,
  deleteSummaryView,
  fetchTask,
  generateSuggestion,
  listSuggestions,
  resetDemo,
  fetchHealth,
};
