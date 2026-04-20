"use client";

import type { SummaryViewData, ComputedSummaryData } from "@/types/memory.types";
import type { DatasetConfig } from "@/types/dataset-config.types";
import type { ComputingTarget } from "./use-summary-views";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/core";
import { SUMMARY_GROUP_BY_KEY } from "@/constants/app.constants";
import { ComputedSummaryCard } from "./computed-summary-card.component";

import "./summary-views-tab.component.css";

type SummaryViewsTabProps = {
  views: SummaryViewData[];
  summaries: Map<string, ComputedSummaryData[]>;
  isLoading: boolean;
  computingTarget: ComputingTarget | null;
  userId: string;
  sessionId: string | null;
  namespace: string;
  config: DatasetConfig;
  onComputeSummary: (viewId: string, group: Record<string, string>) => void;
  error: string | null;
};

const GROUP_VALUE_MAP: Record<string, (props: SummaryViewsTabProps) => string | null> = {
  [SUMMARY_GROUP_BY_KEY.USER_ID]: (props) => props.userId,
  [SUMMARY_GROUP_BY_KEY.SESSION_ID]: (props) => props.sessionId,
  [SUMMARY_GROUP_BY_KEY.NAMESPACE]: (props) => props.namespace,
};

const buildGroupForView = (
  groupBy: string[],
  props: SummaryViewsTabProps,
): Record<string, string> | null => {
  const group: Record<string, string> = {};
  for (const key of groupBy) {
    const resolver = GROUP_VALUE_MAP[key];
    const value = resolver ? resolver(props) : null;
    if (value === null) {
      return null;
    }
    group[key] = value;
  }
  return group;
};

const hasPartitionForGroup = (
  viewSummaries: ComputedSummaryData[],
  group: Record<string, string> | null,
): boolean => {
  if (group === null) {
    return false;
  }
  const groupJson = JSON.stringify(group);
  return viewSummaries.some((s) => JSON.stringify(s.group) === groupJson);
};

const SummaryViewsTab = (props: SummaryViewsTabProps) => {
  const {
    views,
    summaries,
    isLoading,
    computingTarget,
    config,
    onComputeSummary,
    error,
  } = props;

  const labels = config.memoryLabels.summaryViews;

  if (views.length === 0 && !isLoading) {
    return (
      <EmptyState
        title={labels.title}
        description={labels.description}
      />
    );
  }

  return (
    <div className="summary-views-tab">
      {error && (
        <p className="summary-views-tab__error">{error}</p>
      )}

      {views.map((view) => {
        const viewSummaries = summaries.get(view.viewId) ?? [];
        const isAnyComputing = computingTarget !== null;
        const group = buildGroupForView(view.groupBy ?? [], props);
        const groupJson = group !== null ? JSON.stringify(group) : null;
        const isTargetingView = computingTarget !== null && computingTarget.viewId === view.viewId;
        const isComputingCurrentPartition = isTargetingView && groupJson === JSON.stringify(computingTarget.group);
        const canCompute = group !== null;
        const currentGroupExists = hasPartitionForGroup(viewSummaries, group);
        const showComputeButton = canCompute && !currentGroupExists;

        return (
          <div key={view.viewId} className="summary-views-tab__view">
            <div className="summary-views-tab__view-header">
              <h4 className="summary-views-tab__view-name">{view.name}</h4>
              <span className="summary-views-tab__view-meta">
                Source: {view.source} | Group by:{" "}
                {view.groupBy?.join(", ") ?? "none"}
              </span>
            </div>

            <div className="summary-views-tab__view-actions">
              {showComputeButton && (
                <Button
                  size="small"
                  onClick={() => onComputeSummary(view.viewId, group)}
                  disabled={isAnyComputing}
                  variant="contained"
                  startIcon={
                    isComputingCurrentPartition
                      ? <CircularProgress size={14} sx={{ color: "var(--base-white)" }} />
                      : <Sparkles size={14} />
                  }
                  sx={{
                    backgroundColor: "var(--sky-blue-09)",
                    color: "var(--base-white)",
                    textTransform: "none",
                    fontSize: "var(--font-size-xs)",
                    padding: "4px 12px",
                    "&:hover": { backgroundColor: "var(--sky-blue)" },
                    "&.Mui-disabled": {
                      backgroundColor: "var(--sky-blue-09)",
                      color: "var(--base-white)",
                      opacity: 0.5,
                    },
                  }}
                >
                  {isComputingCurrentPartition ? "Computing..." : "Compute summary"}
                </Button>
              )}
              {!canCompute && (
                <span className="summary-views-tab__view-hint">
                  Requires an active session
                </span>
              )}
            </div>

            {viewSummaries.map((s) => {
              const partitionKey = JSON.stringify(s.group);
              const isRecomputing = isTargetingView && JSON.stringify(computingTarget.group) === partitionKey;

              return (
                <ComputedSummaryCard
                  key={`${view.viewId}-${partitionKey}`}
                  summary={s}
                  viewName={view.name}
                  source={view.source}
                  isRecomputing={isRecomputing}
                  isAnyComputing={isAnyComputing}
                  onRecompute={() => onComputeSummary(view.viewId, s.group)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export { SummaryViewsTab };
export type { SummaryViewsTabProps };
