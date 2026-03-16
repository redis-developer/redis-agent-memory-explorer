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
  isComputingSummary: boolean;
  defaultSummaryViewId: string | null;
  userId: string;
  config: DatasetConfig;
  onComputeSummary: (viewId: string, group: Record<string, string>) => void;
  onFetchSummaries: (viewId: string) => void;
  error: string | null;
};

const SummaryViewsTab = ({
  views,
  summaries,
  isLoading,
  isComputingSummary,
  defaultSummaryViewId,
  userId,
  config,
  onComputeSummary,
  onFetchSummaries,
  error,
}: SummaryViewsTabProps) => {
  const labels = config.memoryLabels.summaryViews;

  const defaultView = views.find(
    (v) => v.isDefault || v.viewId === defaultSummaryViewId,
  );
  const defaultViewId = defaultView?.viewId ?? null;
  const defaultSummaries = defaultViewId
    ? summaries.get(defaultViewId) ?? []
    : [];

  const handleComputeDefault = () => {
    if (!defaultViewId) return;
    onComputeSummary(defaultViewId, { [SUMMARY_GROUP_BY_KEY.USER_ID]: userId });
  };

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
      {defaultView && (
        <div className="summary-views-tab__default-view">
          <div className="summary-views-tab__view-header">
            <h4 className="summary-views-tab__view-name">{defaultView.name}</h4>
            <span className="summary-views-tab__view-meta">
              Source: {defaultView.source} | Group by:{" "}
              {defaultView.groupBy?.join(", ") ?? "none"}
            </span>
          </div>

          {defaultSummaries.length === 0 && (
            <Button
              onClick={handleComputeDefault}
              disabled={isComputingSummary}
              variant="contained"
              startIcon={
                isComputingSummary ? (
                  <CircularProgress size={16} sx={{ color: "var(--base-white)" }} />
                ) : (
                  <AutoAwesomeIcon />
                )
              }
              className="summary-views-tab__compute-btn"
              sx={{
                backgroundColor: "var(--sky-blue-09)",
                color: "var(--base-white)",
                textTransform: "none",
                "&:hover": { backgroundColor: "var(--sky-blue)" },
              }}
            >
              {isComputingSummary ? "Computing..." : "Compute Summary"}
            </Button>
          )}

          {defaultSummaries.map((s, idx) => (
            <ComputedSummaryCard
              key={`default-${idx}`}
              summary={s}
              viewName={defaultView.name}
              source={defaultView.source}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="summary-views-tab__error">{error}</p>
      )}

      {views
        .filter((v) => v.viewId !== defaultViewId && v.name !== defaultView?.name)
        .map((view) => {
          const viewSummaries = summaries.get(view.viewId) ?? [];

          return (
            <div key={view.viewId} className="summary-views-tab__view">
              <div className="summary-views-tab__view-header">
                <h4 className="summary-views-tab__view-name">{view.name}</h4>
                <span className="summary-views-tab__view-meta">
                  Source: {view.source} | Group by:{" "}
                  {view.groupBy?.join(", ") ?? "none"}
                </span>
              </div>

              {viewSummaries.length === 0 && (
                <div className="summary-views-tab__view-actions">
                  <Button
                    size="small"
                    onClick={() => onComputeSummary(view.viewId, { [SUMMARY_GROUP_BY_KEY.USER_ID]: userId })}
                    disabled={isComputingSummary}
                    sx={{
                      color: "var(--sky-blue)",
                      textTransform: "none",
                      fontSize: "var(--font-size-xs)",
                    }}
                  >
                    Compute
                  </Button>
                  <Button
                    size="small"
                    onClick={() => onFetchSummaries(view.viewId)}
                    sx={{
                      color: "var(--fg-muted)",
                      textTransform: "none",
                      fontSize: "var(--font-size-xs)",
                    }}
                  >
                    Refresh
                  </Button>
                </div>
              )}

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
