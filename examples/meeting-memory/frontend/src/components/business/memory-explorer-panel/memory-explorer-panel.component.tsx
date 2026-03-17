"use client";

import type { DatasetConfig } from "@/types/dataset-config.types";
import type { AppendResult } from "@/types/memory.types";

import { useState, useEffect, useRef } from "react";

import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import { DEMO_TAB } from "@/constants/app.constants";

import { WorkingMemoryTab } from "./working-memory-tab.component";
import { LongTermMemoryTab } from "./long-term-memory-tab.component";
import { SummaryViewsTab } from "./summary-views-tab.component";
import { RedisMetricsTab } from "./redis-metrics-tab.component";
import { useWorkingMemory } from "./use-working-memory";
import { useLongTermMemory } from "./use-long-term-memory";
import { useSummaryViews } from "./use-summary-views";

import "./memory-explorer-panel.component.css";

type MemoryExplorerPanelProps = {
  userId: string;
  namespace: string;
  sessionId: string | null;
  datasetConfig: DatasetConfig;
  lastAppendResult?: AppendResult | null;
};

const MemoryExplorerPanel = ({
  userId,
  namespace,
  sessionId,
  datasetConfig,
  lastAppendResult,
}: MemoryExplorerPanelProps) => {
  const [activeTab, setActiveTab] = useState<string>(DEMO_TAB.WORKING_MEMORY);
  const hasSession = sessionId !== null;

  const prevSessionIdRef = useRef(sessionId);

  const workingMemory = useWorkingMemory(sessionId, hasSession);
  const longTermMemory = useLongTermMemory(sessionId);
  const summaryViews = useSummaryViews();

  useEffect(() => {
    const wasReset = prevSessionIdRef.current !== null && sessionId === null;
    prevSessionIdRef.current = sessionId;
    if (wasReset) {
      summaryViews.resetAndRefresh();
    }
  }, [sessionId]);

  const tabLabels = datasetConfig.memoryLabels;

  const handleTabChange = (_: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
    const isSummaryTab = newValue === DEMO_TAB.SUMMARY_VIEWS;
    if (isSummaryTab) {
      summaryViews.refreshViews();
    }
  };

  return (
    <div className="memory-explorer-panel">
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        className="memory-explorer-panel__tabs"
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 40,
          borderBottom: "1px solid var(--border)",
          "& .MuiTab-root": {
            color: "var(--fg-muted)",
            fontSize: "var(--font-size-xs)",
            textTransform: "none",
            minHeight: 40,
            padding: "8px 16px",
          },
          "& .Mui-selected": {
            color: "var(--fg-default) !important",
          },
          "& .MuiTabs-indicator": {
            backgroundColor: "var(--primary-color)",
          },
        }}
      >
        <Tab label={tabLabels.workingMemory.title} value={DEMO_TAB.WORKING_MEMORY} />
        <Tab label={tabLabels.longTermMemory.title} value={DEMO_TAB.LONG_TERM_MEMORY} />
        <Tab label={tabLabels.summaryViews.title} value={DEMO_TAB.SUMMARY_VIEWS} />
        <Tab label={tabLabels.metrics.title} value={DEMO_TAB.REDIS_METRICS} />
      </Tabs>

      <div className="memory-explorer-panel__content">
        {activeTab === DEMO_TAB.WORKING_MEMORY && (
          <WorkingMemoryTab
            data={workingMemory.data}
            isLoading={workingMemory.isLoading}
            config={datasetConfig}
            onRefresh={workingMemory.refetch}
            lastAppendResult={lastAppendResult ?? null}
          />
        )}

        {activeTab === DEMO_TAB.LONG_TERM_MEMORY && (
          <LongTermMemoryTab
            memories={longTermMemory.memories}
            total={longTermMemory.total}
            isLoading={longTermMemory.isLoading}
            scope={longTermMemory.scope}
            config={datasetConfig}
            onScopeChange={longTermMemory.setScope}
            onRefresh={longTermMemory.refetch}
          />
        )}

        {activeTab === DEMO_TAB.SUMMARY_VIEWS && (
          <SummaryViewsTab
            views={summaryViews.views}
            summaries={summaryViews.summaries}
            isLoading={summaryViews.isLoading}
            computingViewId={summaryViews.computingViewId}
            userId={userId}
            sessionId={sessionId}
            namespace={namespace}
            config={datasetConfig}
            onComputeSummary={summaryViews.computeSummaryForView}
            error={summaryViews.error}
          />
        )}

        {activeTab === DEMO_TAB.REDIS_METRICS && (
          <RedisMetricsTab
            workingMemoryData={workingMemory.data}
            longTermMemorySessionCount={longTermMemory.sessionTotal}
            longTermMemoryAllCount={longTermMemory.allTotal}
            summaryViewCount={summaryViews.summaryViewCount}
            computedSummaryCount={summaryViews.computedSummaryCount}
            config={datasetConfig}
          />
        )}
      </div>
    </div>
  );
};

export { MemoryExplorerPanel };
export type { MemoryExplorerPanelProps };
