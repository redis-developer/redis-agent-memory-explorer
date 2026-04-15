"use client";

import type { WorkingMemoryData, AppendResult } from "@/types/memory.types";
import type { DatasetConfig } from "@/types/dataset-config.types";

import LinearProgress from "@mui/material/LinearProgress";
import IconButton from "@mui/material/IconButton";
import { RefreshCw } from "lucide-react";

import { EmptyState, SectionCard } from "@/components/core";
import { CONTEXT_THRESHOLD, LAST_MESSAGES_COUNT } from "@/constants/app.constants";
import { WorkingMemorySummary } from "./working-memory-summary.component";

import "./working-memory-tab.component.css";

type WorkingMemoryTabProps = {
  data: WorkingMemoryData | null;
  isLoading: boolean;
  config: DatasetConfig;
  onRefresh: () => void;
  lastAppendResult: AppendResult | null;
};

const CONTEXT_COLORS = {
  low: "var(--color-episodic)",
  medium: "var(--yellow-08)",
  high: "var(--hyper-05)",
};

const getContextColor = (percentage: number): string => {
  if (percentage > CONTEXT_THRESHOLD.HIGH) return CONTEXT_COLORS.high;
  if (percentage > CONTEXT_THRESHOLD.MEDIUM) return CONTEXT_COLORS.medium;
  return CONTEXT_COLORS.low;
};

const WorkingMemoryTab = ({
  data,
  isLoading,
  config,
  onRefresh,
  lastAppendResult,
}: WorkingMemoryTabProps) => {
  if (!data) {
    return (
      <EmptyState
        title={config.memoryLabels.workingMemory.title}
        description={config.memoryLabels.workingMemory.description}
      />
    );
  }

  const rawContextPercent =
    lastAppendResult?.contextPercentageTotalUsed ?? data.contextPercentageTotalUsed ?? 0;
  const rawUntilSummarization =
    lastAppendResult?.contextPercentageUntilSummarization ?? data.contextPercentageUntilSummarization ?? 0;
  const contextPercent = Math.min(rawContextPercent, CONTEXT_THRESHOLD.FULL);
  const isContextFull = rawContextPercent >= CONTEXT_THRESHOLD.FULL || rawUntilSummarization >= CONTEXT_THRESHOLD.FULL;
  const tokenCount = lastAppendResult?.tokens ?? data.tokens ?? 0;
  const contextColor = getContextColor(rawContextPercent);
  const appendCount = lastAppendResult?.messageCount ?? 0;
  const dataCount = data.messages?.length ?? 0;
  const messageCount = Math.max(appendCount, dataCount);
  const contextSummary = lastAppendResult?.context ?? data.context;
  const hasSummary = contextSummary !== null && contextSummary !== undefined;
  const lastMessages = data.messages?.slice(-LAST_MESSAGES_COUNT) ?? [];

  return (
    <div className="working-memory-tab">
      <SectionCard
        title="Session info"
        actions={
          <IconButton size="small" onClick={onRefresh} sx={{ color: "var(--fg-muted)" }}>
            <RefreshCw size={16} />
          </IconButton>
        }
      >
        <div className="working-memory-tab__session-info">
          <div className="working-memory-tab__info-row">
            <span className="working-memory-tab__info-label">Session</span>
            <span className="working-memory-tab__info-value mono">{data.sessionId}</span>
          </div>
          <div className="working-memory-tab__info-row">
            <span className="working-memory-tab__info-label">User</span>
            <span className="working-memory-tab__info-value">{data.userId}</span>
          </div>
          <div className="working-memory-tab__info-row">
            <span className="working-memory-tab__info-label">Namespace</span>
            <span className="working-memory-tab__info-value">{data.namespace}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Context window usage">
        <div className="working-memory-tab__context">
          <LinearProgress
            variant="determinate"
            value={contextPercent}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: "var(--dusk-90)",
              "& .MuiLinearProgress-bar": {
                backgroundColor: contextColor,
                borderRadius: 4,
              },
            }}
          />
          <div className="working-memory-tab__context-stats">
            <span>{messageCount} messages ({tokenCount.toLocaleString()} tokens)</span>
            <span>
              {hasSummary
                ? "Summarized"
                : isContextFull
                  ? `Context full (${Math.round(rawContextPercent)}%)`
                  : `${Math.round(rawContextPercent)}% used`}
            </span>
            <span>
              {hasSummary
                ? "Context compressed"
                : isContextFull
                  ? "Awaiting summarization"
                  : `${Math.round(rawUntilSummarization)}% until summarization`}
            </span>
          </div>
        </div>
      </SectionCard>

      {hasSummary ? (
        <WorkingMemorySummary
          context={contextSummary}
          label={config.memoryLabels.workingMemory.contextSummaryLabel}
        />
      ) : isContextFull ? (
        <SectionCard title={config.memoryLabels.workingMemory.contextSummaryLabel}>
          <p className="working-memory-tab__pending-summary">
            Context window is full. The agent memory server will auto-summarize
            older messages and display the compressed context here.
          </p>
        </SectionCard>
      ) : null}

      <SectionCard title={`Messages (${messageCount})`}>
        <div className="working-memory-tab__messages">
          {lastMessages.map((msg, idx) => (
            <div key={idx} className="working-memory-tab__message">
              <span className="working-memory-tab__message-role">{msg.role}</span>
              <span className="working-memory-tab__message-content">{msg.content}</span>
            </div>
          ))}
          {messageCount > LAST_MESSAGES_COUNT && (
            <p className="working-memory-tab__message-more">
              Showing last {LAST_MESSAGES_COUNT} of {messageCount} messages
            </p>
          )}
        </div>
      </SectionCard>

      {isLoading && (
        <LinearProgress
          sx={{
            backgroundColor: "var(--dusk-90)",
            "& .MuiLinearProgress-bar": { backgroundColor: "var(--sky-blue)" },
          }}
        />
      )}
    </div>
  );
};

export { WorkingMemoryTab };
export type { WorkingMemoryTabProps };
