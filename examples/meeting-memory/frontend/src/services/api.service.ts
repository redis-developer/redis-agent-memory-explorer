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
import type { ApiResponse, HealthResponse, LtSearchResponse } from "@/types/api.types";

import { API_BASE_URL } from "@/constants/app.constants";

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
  apiPost<DatasetConfig>("/api/getDataset");

const fetchTranscripts = (): Promise<{ transcripts: TranscriptSummary[] }> =>
  apiPost<{ transcripts: TranscriptSummary[] }>("/api/listTranscripts");

const fetchTranscript = (transcriptId: string): Promise<TranscriptData> =>
  apiPost<TranscriptData>("/api/getTranscript", { transcriptId });

const createWorkingMemory = (transcriptId: string): Promise<CreateSessionResponse> =>
  apiPost<CreateSessionResponse>("/api/createWorkingMemory", { transcriptId });

const appendChunk = (
  sessionId: string,
  chunk: TranscriptChunk,
  isLastChunk: boolean,
): Promise<AppendResult> =>
  apiPost<AppendResult>("/api/appendWorkingMemory", {
    sessionId,
    chunk,
    isLastChunk,
  });

const fetchWorkingMemory = (sessionId: string): Promise<WorkingMemoryData> =>
  apiPost<WorkingMemoryData>("/api/getWorkingMemory", { sessionId });

const deleteWorkingMemory = (sessionId: string): Promise<void> =>
  apiPost<void>("/api/deleteWorkingMemory", { sessionId });

const searchLongTermMemory = (params: {
  text?: string;
  memoryType?: string;
  topics?: string[];
  entities?: string[];
  limit?: number;
  offset?: number;
}): Promise<LtSearchResponse> =>
  apiPost<LtSearchResponse>("/api/searchLongTermMemory", params);

const searchLongTermMemoryBySession = (sessionId: string): Promise<LtSearchResponse> =>
  apiPost<LtSearchResponse>("/api/searchLongTermMemoryBySession", { sessionId });

const createSummaryView = (input: {
  name?: string;
  source: string;
  groupBy?: string[];
  timeWindowDays?: number;
}): Promise<SummaryViewData> =>
  apiPost<SummaryViewData>("/api/createSummaryView", input);

const listSummaryViews = (): Promise<{ views: SummaryViewData[] }> =>
  apiPost<{ views: SummaryViewData[] }>("/api/listSummaryViews");

const computeSummary = (
  viewId: string,
  group: Record<string, string>,
): Promise<ComputedSummaryData & { viewId: string }> =>
  apiPost<ComputedSummaryData & { viewId: string }>("/api/computeSummary", { viewId, group });

const fetchComputedSummaries = (viewId: string): Promise<{ summaries: ComputedSummaryData[] }> =>
  apiPost<{ summaries: ComputedSummaryData[] }>("/api/getComputedSummaries", { viewId });

const deleteSummaryView = (viewId: string): Promise<void> =>
  apiPost<void>("/api/deleteSummaryView", { viewId });

const fetchTask = (taskId: string): Promise<{ id: string; status: string; result: unknown }> =>
  apiPost<{ id: string; status: string; result: unknown }>("/api/getTask", { taskId });

const resetDemo = (): Promise<{
  deletedWorkingMemory: number;
  deletedLongTermMemory: number;
  recreatedSummaryView: boolean;
}> =>
  apiPost<{
    deletedWorkingMemory: number;
    deletedLongTermMemory: number;
    recreatedSummaryView: boolean;
  }>("/api/resetLifecycle");

const fetchHealth = (): Promise<HealthResponse> =>
  apiGet<HealthResponse>("/health");

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
  searchLongTermMemory,
  searchLongTermMemoryBySession,
  createSummaryView,
  listSummaryViews,
  computeSummary,
  fetchComputedSummaries,
  deleteSummaryView,
  fetchTask,
  resetDemo,
  fetchHealth,
};
