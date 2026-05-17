import type { DatasetConfig } from "@/types/dataset-config.types";
import type {
  TranscriptData,
  TranscriptSummary,
  TranscriptChunk,
} from "@/types/transcript.types";
import type {
  SessionMemoryData,
  AppendResult,
  CreateSessionResponse,
} from "@/types/memory.types";
import type {
  ApiResponse,
  DeleteWorkingMemoryResponse,
  HealthResponse,
  ListSessionsResponse,
  LtSearchResponse,
  ResetResult,
  TaskResponse,
} from "@/types/api.types";
import type {
  GenerateSuggestionResponse,
  ListSuggestionsResponse,
} from "@/types/suggestion.types";

import { API_BASE_URL, API_ERROR_EVENT } from "@/constants/app.constants";

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
  GET_TASK: "/api/getTask",
  GENERATE_SUGGESTION: "/api/generateSuggestion",
  LIST_SUGGESTIONS: "/api/listSuggestions",
  RESET_LIFECYCLE: "/api/resetLifecycle",
  HEALTH: "/health",
} as const;

const emitApiError = (message: string): void => {
  window.dispatchEvent(
    new CustomEvent(API_ERROR_EVENT, { detail: { message } }),
  );
};

const apiPost = async <T>(path: string, body: unknown = {}): Promise<T> => {
  try {
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
  } catch (err) {
    emitApiError((err as Error).message);
    throw err;
  }
};

const apiGet = async <T>(path: string): Promise<T> => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json: ApiResponse<T> = await response.json();
    if (json.error) {
      throw new Error(json.error);
    }

    return json.data as T;
  } catch (err) {
    emitApiError((err as Error).message);
    throw err;
  }
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

const fetchWorkingMemory = (sessionId: string): Promise<SessionMemoryData> =>
  apiPost<SessionMemoryData>(API_PATH.GET_WORKING_MEMORY, { sessionId });

// Not yet used -- available for manual session cleanup from the UI
const deleteWorkingMemory = (
  sessionId: string,
): Promise<DeleteWorkingMemoryResponse> =>
  apiPost<DeleteWorkingMemoryResponse>(API_PATH.DELETE_WORKING_MEMORY, {
    sessionId,
  });

const listWorkingMemorySessions = (
  limit?: number,
  pageToken?: string,
): Promise<ListSessionsResponse> =>
  apiPost<ListSessionsResponse>(API_PATH.LIST_WORKING_MEMORY_SESSIONS, {
    limit,
    pageToken,
  });

const searchLongTermMemory = (params: {
  text?: string;
  memoryType?: string;
  topics?: string[];
}): Promise<LtSearchResponse> =>
  apiPost<LtSearchResponse>(API_PATH.SEARCH_LONG_TERM_MEMORY, params);

const searchLongTermMemoryBySession = (
  sessionId: string,
): Promise<LtSearchResponse> =>
  apiPost<LtSearchResponse>(API_PATH.SEARCH_LONG_TERM_MEMORY_BY_SESSION, {
    sessionId,
  });

// Not yet used -- reserved for polling async task status
const fetchTask = (taskId: string): Promise<TaskResponse> =>
  apiPost<TaskResponse>(API_PATH.GET_TASK, {
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

const listSuggestions = (sessionId: string): Promise<ListSuggestionsResponse> =>
  apiPost<ListSuggestionsResponse>(API_PATH.LIST_SUGGESTIONS, { sessionId });

const resetDemo = (): Promise<ResetResult> =>
  apiPost<ResetResult>(API_PATH.RESET_LIFECYCLE);

const fetchHealth = (): Promise<HealthResponse> =>
  apiGet<HealthResponse>(API_PATH.HEALTH);

export {
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
  fetchTask,
  generateSuggestion,
  listSuggestions,
  resetDemo,
  fetchHealth,
};
