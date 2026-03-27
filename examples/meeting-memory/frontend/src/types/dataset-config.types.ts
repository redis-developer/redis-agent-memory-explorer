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

type SummaryViewConfigEntry = {
  name: string;
  source: string;
  groupBy: string[];
  filters?: Record<string, unknown>;
  timeWindowDays?: number;
  continuous?: boolean;
  prompt?: string;
};

type ChatbotConfig = {
  title: string;
  initialMessage: string;
  placeholder: string;
  instructions: string;
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
    sessionDropdownLabel: string;
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
  chatbot: ChatbotConfig;
};

type UseDatasetConfigResult = {
  config: DatasetConfig | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
};

export type {
  RoleConfig,
  ParticipantConfig,
  MemoryTypeLabel,
  SummaryViewConfigEntry,
  ChatbotConfig,
  DatasetConfig,
  UseDatasetConfigResult,
};
