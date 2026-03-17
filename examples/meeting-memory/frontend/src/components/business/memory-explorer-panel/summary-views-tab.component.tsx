"use client";

import type { SummaryViewData, ComputedSummaryData } from "@/types/memory.types";
import type { DatasetConfig } from "@/types/dataset-config.types";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { EmptyState } from "@/components/core";
import { SUMMARY_GROUP_BY_KEY } from "@/constants/app.constants";
import { ComputedSummaryCard } from "./computed-summary-card.component";

import "./summary-views-tab.component.css";

type SummaryViewsTabProps = {
  views: SummaryViewData[];
  summaries: Map<string, ComputedSummaryData[]>;
  isLoading: boolean;
  computingViewId: string | null;
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

const SummaryViewsTab = (props: SummaryViewsTabProps) => {
  const {
    views,
    summaries,
    isLoading,
    computingViewId,
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
        const hasSummaries = viewSummaries.length > 0;
        const isComputing = computingViewId === view.viewId;
        const isAnyComputing = computingViewId !== null;
        const group = buildGroupForView(view.groupBy ?? [], props);
        const canCompute = group !== null;
        const computeLabel = hasSummaries ? "Recompute" : "Compute Summary";

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
              <Button
                size="small"
                onClick={() => {
                  if (canCompute) {
                    onComputeSummary(view.viewId, group);
                  }
                }}
                disabled={!canCompute || isAnyComputing}
                variant="contained"
                startIcon={
                  isComputing ? (
                    <CircularProgress size={14} sx={{ color: "var(--base-white)" }} />
                  ) : (
                    <AutoAwesomeIcon sx={{ fontSize: 14 }} />
                  )
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
                {isComputing ? "Computing..." : computeLabel}
              </Button>
              {!canCompute && (
                <span className="summary-views-tab__view-hint">
                  Requires an active session
                </span>
              )}
            </div>

            {viewSummaries.map((s, idx) => (
              <ComputedSummaryCard
                key={`${view.viewId}-${idx}`}
                summary={s}
                viewName={view.name}
                source={view.source}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

export { SummaryViewsTab };
export type { SummaryViewsTabProps };
