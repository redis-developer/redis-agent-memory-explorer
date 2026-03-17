import type {
  MemoryType,
  SummaryViewSource,
} from "cau-redis-agent-memory";

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
  namespace: string;
  userId: string;
  branding: {
    title: string;
    subtitle: string;
    footerText: string;
    accentColor: string;
  };
  roles: Record<string, RoleConfig>;
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
    summaryViews: {
      title: string;
      description: string;
      views: SummaryViewConfigEntry[];
    };
    metrics: {
      title: string;
      description: string;
    };
  };
  transcriptPanel: {
    title: string;
    playingLabel: string;
    completedLabel: string;
  };
  toolbar: {
    transcriptDropdownLabel: string;
    playLabel: string;
    stopLabel: string;
    resetLabel: string;
    speedLabel: string;
  };
  statusLabels: Record<string, string>;
  playbackDefaults: {
    intervalMs: number;
    speeds: Array<{ label: string; intervalMs: number }>;
  };
};

type SummaryViewConfigEntry = {
  name: string;
  source: SummaryViewSource;
  groupBy: string[];
  filters?: Record<string, unknown>;
  timeWindowDays?: number;
  continuous?: boolean;
  prompt?: string;
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
  offset?: number;
};

type SearchLongTermMemoryInput = {
  text?: string;
  memoryType?: MemoryType;
  topics?: string[];
  entities?: string[];
  limit?: number;
  offset?: number;
};

type SearchLongTermMemoryBySessionInput = {
  sessionId: string;
};

type CreateSummaryViewInput = {
  name?: string;
  source: SummaryViewSource;
  groupBy?: string[];
  timeWindowDays?: number;
};

type GetSummaryViewInput = {
  viewId: string;
};

type ComputeSummaryInput = {
  viewId: string;
  group: Record<string, string>;
};

type GetComputedSummariesInput = {
  viewId: string;
};

type DeleteSummaryViewInput = {
  viewId: string;
};

type GetTaskInput = {
  taskId: string;
};

type ForgetLifecycleInput = {
  policy: {
    maxAgeDays?: number;
    maxInactiveDays?: number;
    budget?: number;
  };
  dryRun?: boolean;
};

// --- App state (set at startup, read by handlers) ---

type AppState = {
  datasetConfig: DatasetConfig | null;
  namespace: string;
  userId: string;
};

export type {
  RoleConfig,
  ParticipantConfig,
  MemoryTypeLabel,
  SummaryViewConfigEntry,
  DatasetConfig,
  DatasetSummary,
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
  CreateSummaryViewInput,
  GetSummaryViewInput,
  ComputeSummaryInput,
  GetComputedSummariesInput,
  DeleteSummaryViewInput,
  GetTaskInput,
  ForgetLifecycleInput,
  AppState,
};
