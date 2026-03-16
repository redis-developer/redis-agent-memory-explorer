"use client";

import type { WorkingMemoryData } from "@/types/memory.types";
import type { DatasetConfig } from "@/types/dataset-config.types";

import { SectionCard } from "@/components/core";

import "./redis-metrics-tab.component.css";

type RedisMetricsTabProps = {
  workingMemoryData: WorkingMemoryData | null;
  longTermMemoryCount: number;
  computedSummaryCount: number;
  config: DatasetConfig;
};

const RedisMetricsTab = ({
  workingMemoryData,
  longTermMemoryCount,
  computedSummaryCount,
  config,
}: RedisMetricsTabProps) => {
  const messageCount = workingMemoryData?.messages?.length ?? 0;
  const tokens = workingMemoryData?.tokens ?? 0;

  return (
    <div className="redis-metrics-tab">
      <h3 className="redis-metrics-tab__title">{config.memoryLabels.metrics.title}</h3>
      <p className="redis-metrics-tab__description">
        {config.memoryLabels.metrics.description}
      </p>

      <SectionCard title="Memory Lifecycle">
        <div className="redis-metrics-tab__lifecycle">
          <div className="redis-metrics-tab__row">
            <span className="redis-metrics-tab__label">Working Memory</span>
            <span className="redis-metrics-tab__value">
              {messageCount} messages, {tokens.toLocaleString()} tokens
            </span>
          </div>
          <div className="redis-metrics-tab__row">
            <span className="redis-metrics-tab__label">Extraction</span>
            <span className="redis-metrics-tab__value">
              {longTermMemoryCount} long-term facts
            </span>
          </div>
          <div className="redis-metrics-tab__row">
            <span className="redis-metrics-tab__label">Summarization</span>
            <span className="redis-metrics-tab__value">
              {computedSummaryCount} computed {computedSummaryCount === 1 ? "summary" : "summaries"}
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

export { RedisMetricsTab };
export type { RedisMetricsTabProps };
