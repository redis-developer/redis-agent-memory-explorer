"use client";

import type { SessionMemoryData, AppendResult } from "@/types/memory.types";
import type { DatasetConfig } from "@/types/dataset-config.types";

import LinearProgress from "@mui/material/LinearProgress";
import IconButton from "@mui/material/IconButton";
import { RefreshCw } from "lucide-react";

import { EmptyState, SectionCard } from "@/components/core";
import { LAST_MESSAGES_COUNT } from "@/constants/app.constants";
import { WorkingMemorySummary } from "./working-memory-summary.component";

import "./working-memory-tab.component.css";

type WorkingMemoryTabProps = {
  data: SessionMemoryData | null;
  isLoading: boolean;
  config: DatasetConfig;
  onRefresh: () => void;
  lastAppendResult: AppendResult | null;
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

  const events = data.events ?? [];
  const eventCount = events.length;
  const lastEvents = events.slice(-LAST_MESSAGES_COUNT);
  const latencyLabel =
    lastAppendResult?.latencyMs !== undefined
      ? `${lastAppendResult.latencyMs}ms`
      : "--";

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
            <span className="working-memory-tab__info-label">Owner</span>
            <span className="working-memory-tab__info-value">{data.ownerId}</span>
          </div>
          <div className="working-memory-tab__info-row">
            <span className="working-memory-tab__info-label">Events</span>
            <span className="working-memory-tab__info-value">{eventCount}</span>
          </div>
          <div className="working-memory-tab__info-row">
            <span className="working-memory-tab__info-label">Last append</span>
            <span className="working-memory-tab__info-value mono">{latencyLabel}</span>
          </div>
        </div>
      </SectionCard>

      {data.summary && (
        <WorkingMemorySummary
          context={data.summary}
          label={config.memoryLabels.workingMemory.contextSummaryLabel}
        />
      )}

      <SectionCard
        title={`Session events (${eventCount})`}
        className="working-memory-tab__messages-card"
      >
        <div className="working-memory-tab__messages">
          {lastEvents.map((evt) => (
            <div key={evt.eventId} className="working-memory-tab__message">
              <span className="working-memory-tab__message-role">{evt.role}</span>
              <span className="working-memory-tab__message-content">{evt.content}</span>
            </div>
          ))}
          {eventCount > LAST_MESSAGES_COUNT && (
            <p className="working-memory-tab__message-more">
              Showing last {LAST_MESSAGES_COUNT} of {eventCount} events
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
