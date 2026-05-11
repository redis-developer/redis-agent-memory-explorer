"use client";

import type { DatasetConfig } from "@/types/dataset-config.types";

import { useState, useEffect, useRef, useCallback } from "react";

import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import { DEMO_TAB, DEFAULT_TRIGGER_EVERY_N_CHUNKS } from "@/constants/app.constants";

import { WorkingMemoryTab } from "./working-memory-tab.component";
import { LongTermMemoryTab } from "./long-term-memory-tab.component";
import { RedisMetricsTab } from "./redis-metrics-tab.component";
import { useWorkingMemory } from "./use-working-memory";
import { useLongTermMemory } from "./use-long-term-memory";
import { AiCopilotTab, SuggestionBanner, useSuggestions } from "./ai-copilot";

import "./memory-explorer-panel.component.css";

type MemoryExplorerPanelProps = {
  userId: string;
  sessionId: string | null;
  datasetConfig: DatasetConfig;
  currentChunkIndex?: number;
  isPlaybackComplete?: boolean;
};

const MemoryExplorerPanel = ({
  userId,
  sessionId,
  datasetConfig,
  currentChunkIndex = 0,
  isPlaybackComplete = false,
}: MemoryExplorerPanelProps) => {
  const suggestionsConfig = datasetConfig.suggestions;
  const hasSuggestions = suggestionsConfig !== undefined;

  const defaultTab = hasSuggestions ? DEMO_TAB.AI_COPILOT : DEMO_TAB.WORKING_MEMORY;
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const hasSession = sessionId !== null;

  const prevSessionIdRef = useRef(sessionId);

  const workingMemory = useWorkingMemory(sessionId, hasSession, isPlaybackComplete);
  const longTermMemory = useLongTermMemory(sessionId, isPlaybackComplete);

  const triggerEveryN = suggestionsConfig?.triggerEveryNChunks ?? DEFAULT_TRIGGER_EVERY_N_CHUNKS;

  const suggestions = useSuggestions({
    sessionId,
    currentChunkIndex,
    isPlaybackComplete: isPlaybackComplete,
    triggerEveryNChunks: triggerEveryN,
  });

  useEffect(() => {
    const sessionChanged = prevSessionIdRef.current !== sessionId;
    prevSessionIdRef.current = sessionId;
    if (sessionChanged) {
      const shouldAutoSwitch = hasSuggestions && sessionId !== null;
      if (shouldAutoSwitch) {
        setActiveTab(DEMO_TAB.AI_COPILOT);
      }
    }
  }, [sessionId]);

  const [scrollToTopSignal, setScrollToTopSignal] = useState(0);

  const handleViewSuggestionDetails = useCallback(() => {
    setActiveTab(DEMO_TAB.AI_COPILOT);
    setScrollToTopSignal((prev) => prev + 1);
  }, []);

  const tabLabels = datasetConfig.memoryLabels;

  const handleTabChange = (_: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
    const isLtTab = newValue === DEMO_TAB.LONG_TERM_MEMORY;
    if (isLtTab) {
      longTermMemory.refetch();
    }
  };

  return (
    <div className="memory-explorer-panel">
      {hasSuggestions && (
        <SuggestionBanner
          suggestion={suggestions.latestSuggestion}
          bannerLabel={suggestionsConfig.bannerLabel}
          noSuggestionsMessage={suggestionsConfig.noSuggestionsMessage}
          onViewDetails={handleViewSuggestionDetails}
        />
      )}

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
            fontWeight: 400,
            textTransform: "none",
            minHeight: 40,
            padding: "8px 16px",
            textUnderlineOffset: "4px",
          },
          "& .MuiTab-root:hover": {
            color: "var(--fg-default)",
          },
          "& .Mui-selected": {
            color: "var(--yellow) !important",
            textDecoration: "underline",
          },
          "& .Mui-selected:hover": {
            color: "var(--yellow) !important",
          },
          "& .MuiTabs-indicator": {
            display: "none",
          },
        }}
      >
        {hasSuggestions && (
          <Tab label={suggestionsConfig.title} value={DEMO_TAB.AI_COPILOT} />
        )}
        <Tab label={tabLabels.workingMemory.title} value={DEMO_TAB.WORKING_MEMORY} />
        <Tab label={tabLabels.longTermMemory.title} value={DEMO_TAB.LONG_TERM_MEMORY} />
        <Tab label={tabLabels.metrics.title} value={DEMO_TAB.REDIS_METRICS} />
      </Tabs>

      <div className="memory-explorer-panel__content">
        {activeTab === DEMO_TAB.AI_COPILOT && (
          <AiCopilotTab
            suggestions={suggestions.suggestions}
            detectedTopics={suggestions.detectedTopics}
            isGenerating={suggestions.isGenerating}
            isActive={currentChunkIndex > 0 && !isPlaybackComplete}
            isComplete={isPlaybackComplete}
            labels={suggestionsConfig!}
            scrollToTopSignal={scrollToTopSignal}
          />
        )}

        {activeTab === DEMO_TAB.WORKING_MEMORY && (
          <WorkingMemoryTab
            data={workingMemory.data}
            isLoading={workingMemory.isLoading}
            config={datasetConfig}
            onRefresh={workingMemory.refetch}
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

        {activeTab === DEMO_TAB.REDIS_METRICS && (
          <RedisMetricsTab
            workingMemoryData={workingMemory.data}
            longTermMemorySessionCount={longTermMemory.sessionTotal}
            longTermMemoryAllCount={longTermMemory.allTotal}
            config={datasetConfig}
          />
        )}
      </div>
    </div>
  );
};

export { MemoryExplorerPanel };
export type { MemoryExplorerPanelProps };
