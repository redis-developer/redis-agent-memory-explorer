import type {
  MemoryType,
  ExtractionStrategy,
  SummaryViewSource,
  TaskStatus,
} from "./constants";

// --- Config ---

type AgentMemoryConfig = {
  baseUrl?: string;
  timeout?: number;
  apiKey?: string;
  bearerToken?: string;
  defaultNamespace?: string;
  defaultModelName?: string;
  defaultContextWindowMax?: number;
};

type RawClientConfig = {
  baseUrl: string;
  apiKey?: string;
  bearerToken?: string;
  defaultNamespace?: string;
  timeout?: number;
};

// --- Working Memory ---

type MemoryMessage = {
  role: string;
  content: string;
  id?: string;
  createdAt?: string;
};

type MemoryExtractionStrategy = {
  strategy: ExtractionStrategy;
  config?: Record<string, unknown>;
};

type WorkingMemoryPayload = {
  messages?: MemoryMessage[];
  memories?: MemoryRecordInput[];
  data?: Record<string, unknown>;
  context?: string;
  userId?: string;
  namespace?: string;
  ttlSeconds?: number;
  longTermMemoryStrategy?: MemoryExtractionStrategy;
};

type WorkingMemoryResult = {
  sessionId: string;
  messages: MemoryMessage[];
  memories: MemoryRecordResult[];
  data: Record<string, unknown> | null;
  context: string | null;
  userId: string | null;
  namespace: string | null;
  tokens: number;
  ttlSeconds: number | null;
  lastAccessed: string;
  createdAt: string;
  updatedAt: string;
  contextPercentageTotalUsed: number | null;
  contextPercentageUntilSummarization: number | null;
};

type WorkingMemoryOptions = {
  userId?: string;
  namespace?: string;
  modelName?: string;
  contextWindowMax?: number;
  recentMessagesLimit?: number;
};

type SessionListResult = {
  sessions: string[];
  total: number;
};

type SessionListOptions = {
  limit?: number;
  offset?: number;
  namespace?: string;
  userId?: string;
};

// --- Long-Term Memory ---

type MemoryRecordInput = {
  text: string;
  memoryType?: MemoryType;
  topics?: string[];
  entities?: string[];
  userId?: string;
  sessionId?: string;
  namespace?: string;
  eventDate?: string;
  id?: string;
  pinned?: boolean;
};

type MemoryRecordResult = {
  id: string;
  text: string;
  memoryType: MemoryType;
  topics: string[] | null;
  entities: string[] | null;
  userId: string | null;
  sessionId: string | null;
  namespace: string | null;
  eventDate: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessed: string;
  persistedAt: string | null;
  pinned: boolean;
  accessCount: number;
  memoryHash: string | null;
  dist: number | null;
};

type MemoryEditInput = {
  text?: string;
  topics?: string[];
  entities?: string[];
  memoryType?: MemoryType;
  eventDate?: string;
  namespace?: string;
  userId?: string;
  sessionId?: string;
};

type CreateMemoriesOptions = {
  deduplicate?: boolean;
};

// --- Search ---

type TagFilter = {
  eq?: string;
  ne?: string;
  any?: string[];
  all?: string[];
  in?: string[];
  notIn?: string[];
};

type DateFilter = {
  gte?: Date | string;
  lte?: Date | string;
  eq?: Date | string;
};

type MemorySearchOptions = {
  text?: string;
  sessionId?: TagFilter;
  namespace?: TagFilter;
  userId?: TagFilter;
  topics?: TagFilter;
  entities?: TagFilter;
  memoryType?: TagFilter;
  createdAt?: DateFilter;
  lastAccessed?: DateFilter;
  eventDate?: DateFilter;
  distanceThreshold?: number;
  limit?: number;
  offset?: number;
  recencyBoost?: boolean;
  optimizeQuery?: boolean;
};

type MemorySearchResult = {
  memories: MemoryRecordResult[];
  total: number;
  nextOffset: number | null;
};

type SearchAllOptions = Omit<MemorySearchOptions, "limit" | "offset"> & {
  batchSize?: number;
};

type SearchAllResult = {
  memories: MemoryRecordResult[];
  total: number;
};

// --- Memory Prompt ---

type MemoryPromptRequest = {
  query: string;
  session?: {
    sessionId: string;
    userId?: string;
    modelName?: string;
    contextWindowMax?: number;
  };
  longTermSearch?: MemorySearchOptions | boolean;
};

type MemoryPromptResult = {
  messages: Array<{ role: string; content: string }>;
};

// --- Forget ---

type ForgetPolicy = {
  maxAgeDays?: number;
  maxInactiveDays?: number;
  budget?: number;
  memoryTypeAllowlist?: MemoryType[];
};

type ForgetOptions = {
  namespace?: string;
  userId?: string;
  sessionId?: string;
  limit?: number;
  dryRun?: boolean;
  pinnedIds?: string[];
};

type ForgetResult = {
  deleted: number;
  scanned: number;
  deletedIds?: string[];
};

// --- Summary Views ---

type CreateSummaryViewInput = {
  name?: string;
  source: SummaryViewSource;
  groupBy?: string[];
  filters?: Record<string, unknown>;
  timeWindowDays?: number;
  continuous?: boolean;
  prompt?: string;
  modelName?: string;
};

type SummaryViewResult = {
  id: string;
  name: string | null;
  source: SummaryViewSource;
  groupBy: string[];
  filters: Record<string, unknown>;
  timeWindowDays: number | null;
  continuous: boolean;
  prompt: string | null;
  modelName: string | null;
};

type SummaryPartitionResult = {
  viewId: string;
  group: Record<string, string>;
  summary: string;
  memoryCount: number;
  computedAt: string;
};

type PartitionListFilters = {
  userId?: string;
  namespace?: string;
  sessionId?: string;
  memoryType?: string;
};

// --- Tasks ---

type TaskResult = {
  id: string;
  type: string;
  status: TaskStatus;
  viewId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
};

// --- Common ---

type AckResult = {
  status: string;
};

type HealthResult = {
  now: number;
};

export type {
  AgentMemoryConfig,
  RawClientConfig,
  MemoryMessage,
  MemoryExtractionStrategy,
  WorkingMemoryPayload,
  WorkingMemoryResult,
  WorkingMemoryOptions,
  SessionListResult,
  SessionListOptions,
  MemoryRecordInput,
  MemoryRecordResult,
  MemoryEditInput,
  CreateMemoriesOptions,
  TagFilter,
  DateFilter,
  MemorySearchOptions,
  MemorySearchResult,
  SearchAllOptions,
  SearchAllResult,
  MemoryPromptRequest,
  MemoryPromptResult,
  ForgetPolicy,
  ForgetOptions,
  ForgetResult,
  CreateSummaryViewInput,
  SummaryViewResult,
  SummaryPartitionResult,
  PartitionListFilters,
  TaskResult,
  AckResult,
  HealthResult,
};
