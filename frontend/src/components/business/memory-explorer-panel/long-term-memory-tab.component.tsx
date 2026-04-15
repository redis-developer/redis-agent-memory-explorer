"use client";

import type { MemoryRecordData } from "@/types/memory.types";
import type { DatasetConfig } from "@/types/dataset-config.types";
import type { MemoryType, LtScope } from "@/constants/app.constants";

import { useMemo } from "react";
import IconButton from "@mui/material/IconButton";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { RefreshCw } from "lucide-react";

import { EmptyState, SectionCard } from "@/components/core";
import { LT_SCOPE, MEMORY_TYPE } from "@/constants/app.constants";
import { MemoryCard } from "./memory-card.component";

import "./long-term-memory-tab.component.css";

type LongTermMemoryTabProps = {
  memories: MemoryRecordData[];
  total: number;
  isLoading: boolean;
  scope: LtScope;
  config: DatasetConfig;
  onScopeChange: (scope: LtScope) => void;
  onRefresh: () => void;
};

type GroupedMemories = Record<MemoryType, MemoryRecordData[]>;

const groupByType = (memories: MemoryRecordData[]): GroupedMemories => ({
  [MEMORY_TYPE.SEMANTIC]: memories.filter((m) => m.memoryType === MEMORY_TYPE.SEMANTIC),
  [MEMORY_TYPE.EPISODIC]: memories.filter((m) => m.memoryType === MEMORY_TYPE.EPISODIC),
  [MEMORY_TYPE.MESSAGE]: memories.filter((m) => m.memoryType === MEMORY_TYPE.MESSAGE),
});

const SCOPE_TABS_SX = {
  minHeight: 28,
  "& .MuiTab-root": {
    color: "var(--fg-muted)",
    fontSize: "var(--font-size-2xs)",
    fontFamily: "var(--secondary-font)",
    textTransform: "none" as const,
    minHeight: 28,
    padding: "2px 10px",
    lineHeight: 1.4,
    minWidth: "auto",
  },
  "& .Mui-selected": {
    color: "var(--yellow) !important",
  },
  "& .MuiTabs-indicator": {
    backgroundColor: "var(--yellow)",
    height: 2,
  },
} as const;

const SCOPE_LABELS: Record<LtScope, string> = {
  [LT_SCOPE.SESSION]: "This session",
  [LT_SCOPE.ALL]: "All memories",
};

const LongTermMemoryTab = ({
  memories,
  total,
  isLoading,
  scope,
  config,
  onScopeChange,
  onRefresh,
}: LongTermMemoryTabProps) => {
  const grouped = useMemo(() => groupByType(memories), [memories]);
  const labels = config.memoryLabels.longTermMemory;

  const handleScopeChange = (_: React.SyntheticEvent, newScope: string) => {
    onScopeChange(newScope as LtScope);
  };

  const scopeToggle = (
    <Tabs
      value={scope}
      onChange={handleScopeChange}
      sx={SCOPE_TABS_SX}
    >
      <Tab label={SCOPE_LABELS[LT_SCOPE.SESSION]} value={LT_SCOPE.SESSION} />
      <Tab label={SCOPE_LABELS[LT_SCOPE.ALL]} value={LT_SCOPE.ALL} />
    </Tabs>
  );

  if (memories.length === 0) {
    const emptyDescription = isLoading
      ? "Searching for extracted memories..."
      : labels.description;

    return (
      <div className="long-term-memory-tab">
        <div className="long-term-memory-tab__header">
          {scopeToggle}
          <IconButton size="small" onClick={onRefresh} sx={{ color: "var(--fg-muted)" }}>
            <RefreshCw size={16} />
          </IconButton>
        </div>
        <EmptyState title={labels.title} description={emptyDescription} />
      </div>
    );
  }

  const sections: Array<{
    key: MemoryType;
    label: string;
    description: string;
    items: MemoryRecordData[];
  }> = [
    {
      key: MEMORY_TYPE.SEMANTIC,
      label: labels.semantic.label,
      description: labels.semantic.description,
      items: grouped[MEMORY_TYPE.SEMANTIC],
    },
    {
      key: MEMORY_TYPE.EPISODIC,
      label: labels.episodic.label,
      description: labels.episodic.description,
      items: grouped[MEMORY_TYPE.EPISODIC],
    },
    {
      key: MEMORY_TYPE.MESSAGE,
      label: labels.message.label,
      description: labels.message.description,
      items: grouped[MEMORY_TYPE.MESSAGE],
    },
  ];

  const scopeLabel = scope === LT_SCOPE.SESSION ? "this session" : "all sessions";

  return (
    <div className="long-term-memory-tab">
      <div className="long-term-memory-tab__header">
        {scopeToggle}
        <div className="long-term-memory-tab__header-right">
          <span className="long-term-memory-tab__total">
            {total} {total === 1 ? "memory" : "memories"} from {scopeLabel}
          </span>
          <IconButton size="small" onClick={onRefresh} sx={{ color: "var(--fg-muted)" }}>
            <RefreshCw size={16} />
          </IconButton>
        </div>
      </div>

      {sections.map((section) => (
        <SectionCard
          key={section.key}
          title={`${section.label} (${section.items.length})`}
          description={section.description}
        >
          {section.items.length === 0 ? (
            <p className="long-term-memory-tab__empty-section">
              No {section.key} memories extracted.
            </p>
          ) : (
            <div className="long-term-memory-tab__cards">
              {section.items.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} />
              ))}
            </div>
          )}
        </SectionCard>
      ))}
    </div>
  );
};

export { LongTermMemoryTab };
export type { LongTermMemoryTabProps };
