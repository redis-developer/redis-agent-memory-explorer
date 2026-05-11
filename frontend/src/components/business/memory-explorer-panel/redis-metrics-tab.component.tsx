"use client";

import type { SessionMemoryData } from "@/types/memory.types";
import type { DatasetConfig } from "@/types/dataset-config.types";

import { SectionCard } from "@/components/core";

import "./redis-metrics-tab.component.css";

type RedisMetricsTabProps = {
  workingMemoryData: SessionMemoryData | null;
  longTermMemorySessionCount: number;
  longTermMemoryAllCount: number;
  config: DatasetConfig;
};

const RedisMetricsTab = ({
  workingMemoryData,
  longTermMemorySessionCount,
  longTermMemoryAllCount,
  config,
}: RedisMetricsTabProps) => {
  const eventCount = workingMemoryData?.events?.length ?? 0;

  const rows = [
    {
      label: "Session memory",
      value: `${eventCount} events`,
    },
    {
      label: "Long-term memories (session)",
      value: `${longTermMemorySessionCount} extracted`,
    },
    {
      label: "Long-term memories (all)",
      value: `${longTermMemoryAllCount} total`,
    },
  ];

  return (
    <div className="redis-metrics-tab">
      <h3 className="redis-metrics-tab__title">{config.memoryLabels.metrics.title}</h3>
      <p className="redis-metrics-tab__description">
        {config.memoryLabels.metrics.description}
      </p>

      <SectionCard title="Memory lifecycle">
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
