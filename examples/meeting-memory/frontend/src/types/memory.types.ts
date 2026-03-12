type WorkingMemoryMessage = {
  role: string;
  content: string;
  id?: string;
  createdAt?: string;
};

type WorkingMemoryData = {
  sessionId: string;
  userId: string;
  namespace: string;
  messages: WorkingMemoryMessage[];
  tokens: number;
  context: string | null;
  data: unknown;
  contextPercentageTotalUsed: number | null;
  contextPercentageUntilSummarization: number | null;
  memories: string[];
  createdAt: string;
  updatedAt: string;
  lastAccessed: string;
  ttlSeconds: number | null;
};

type MemoryRecordData = {
  id: string;
  text: string;
  memoryType: "semantic" | "episodic" | "message";
  userId: string;
  sessionId: string;
  namespace: string;
  topics: string[];
  entities: string[];
  eventDate: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessed: string;
  persistedAt: string | null;
  pinned: boolean;
  accessCount: number;
  memoryHash: string;
  dist: number;
};

type SummaryViewData = {
  viewId: string;
  name: string;
  source: string;
  groupBy: string[];
  isDefault?: boolean;
};

type ComputedSummaryData = {
  group: Record<string, string>;
  summary: string;
  memoryCount: number;
  computedAt: string;
};

type AppendResult = {
  messageCount: number;
  tokens: number;
  context: string | null;
  contextPercentageTotalUsed: number;
  contextPercentageUntilSummarization: number;
  latencyMs: number;
};

type CreateSessionResponse = {
  sessionId: string;
  created: boolean;
  memory: WorkingMemoryData;
};

type PlaybackMetrics = {
  chunksProcessed: number;
  totalAppendLatencyMs: number;
  avgAppendLatencyMs: number;
  appendLatencies: number[];
};

type ApiMetrics = {
  workingMemoryReads: number;
  longTermSearches: number;
  summariesComputed: number;
  totalApiCalls: number;
};

export type {
  WorkingMemoryMessage,
  WorkingMemoryData,
  MemoryRecordData,
  SummaryViewData,
  ComputedSummaryData,
  AppendResult,
  CreateSessionResponse,
  PlaybackMetrics,
  ApiMetrics,
};
