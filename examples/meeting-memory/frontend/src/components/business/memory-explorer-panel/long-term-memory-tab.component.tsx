"use client";

import type { MemoryRecordData } from "@/types/memory.types";
import type { DatasetConfig } from "@/types/dataset-config.types";
import type { MemoryType } from "@/constants/app.constants";

import { useMemo } from "react";
import IconButton from "@mui/material/IconButton";
import RefreshIcon from "@mui/icons-material/Refresh";

import { EmptyState, SectionCard } from "@/components/core";
import { MEMORY_TYPE } from "@/constants/app.constants";
import { MemoryCard } from "./memory-card.component";

import "./long-term-memory-tab.component.css";

type LongTermMemoryTabProps = {
  memories: MemoryRecordData[];
  total: number;
  isLoading: boolean;
  config: DatasetConfig;
  onRefresh: () => void;
};

type GroupedMemories = Record<MemoryType, MemoryRecordData[]>;

const groupByType = (memories: MemoryRecordData[]): GroupedMemories => ({
  [MEMORY_TYPE.SEMANTIC]: memories.filter((m) => m.memoryType === MEMORY_TYPE.SEMANTIC),
  [MEMORY_TYPE.EPISODIC]: memories.filter((m) => m.memoryType === MEMORY_TYPE.EPISODIC),
  [MEMORY_TYPE.MESSAGE]: memories.filter((m) => m.memoryType === MEMORY_TYPE.MESSAGE),
});

const LongTermMemoryTab = ({
  memories,
  total,
  isLoading,
  config,
  onRefresh,
}: LongTermMemoryTabProps) => {
  const grouped = useMemo(() => groupByType(memories), [memories]);
  const labels = config.memoryLabels.longTermMemory;

  if (memories.length === 0) {
    return (
      <EmptyState
        title={labels.title}
        description={isLoading ? "Searching for extracted memories..." : labels.description}
      />
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

  return (
    <div className="long-term-memory-tab">
      <div className="long-term-memory-tab__header">
        <span className="long-term-memory-tab__total">
          {total} {total === 1 ? "memory" : "memories"} extracted
        </span>
        <IconButton size="small" onClick={onRefresh} sx={{ color: "var(--fg-muted)" }}>
          <RefreshIcon fontSize="small" />
        </IconButton>
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
