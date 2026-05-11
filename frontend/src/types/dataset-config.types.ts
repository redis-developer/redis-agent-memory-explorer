import type { SuggestionsConfig } from "@/types/suggestion.types";

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
  suggestions?: SuggestionsConfig;
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
  ChatbotConfig,
  DatasetConfig,
  UseDatasetConfigResult,
};
