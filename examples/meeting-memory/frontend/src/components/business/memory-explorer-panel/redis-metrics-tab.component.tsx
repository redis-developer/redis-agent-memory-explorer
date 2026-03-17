"use client";

import type { WorkingMemoryData } from "@/types/memory.types";
import type { DatasetConfig } from "@/types/dataset-config.types";

import { SectionCard } from "@/components/core";

import "./redis-metrics-tab.component.css";

type RedisMetricsTabProps = {
  workingMemoryData: WorkingMemoryData | null;
  longTermMemorySessionCount: number;
  longTermMemoryAllCount: number;
  summaryViewCount: number;
  computedSummaryCount: number;
  config: DatasetConfig;
};

const RedisMetricsTab = ({
  workingMemoryData,
  longTermMemorySessionCount,
  longTermMemoryAllCount,
  summaryViewCount,
  computedSummaryCount,
  config,
}: RedisMetricsTabProps) => {
  const messageCount = workingMemoryData?.messages?.length ?? 0;
  const tokens = workingMemoryData?.tokens ?? 0;

  const rows = [
    {
      label: "Working Memory",
      value: `${messageCount} messages, ${tokens.toLocaleString()} tokens`,
    },
    {
      label: "Long-Term Memories (Session)",
      value: `${longTermMemorySessionCount} extracted`,
    },
    {
      label: "Long-Term Memories (All)",
      value: `${longTermMemoryAllCount} total`,
    },
    {
      label: "Summary Views",
      value: `${summaryViewCount} configured, ${computedSummaryCount} computed`,
    },
  ];

  return (
    <div className="redis-metrics-tab">
      <h3 className="redis-metrics-tab__title">{config.memoryLabels.metrics.title}</h3>
      <p className="redis-metrics-tab__description">
        {config.memoryLabels.metrics.description}
      </p>

      <SectionCard title="Memory Lifecycle">
        <div className="redis-metrics-tab__lifecycle">
          {rows.map((row) => (
            <div key={row.label} className="redis-metrics-tab__row">
              <span className="redis-metrics-tab__label">{row.label}</span>
              <span className="redis-metrics-tab__value">{row.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

export { RedisMetricsTab };
export type { RedisMetricsTabProps };
