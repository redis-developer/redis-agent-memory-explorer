"use client";

import type { ComputedSummaryData } from "@/types/memory.types";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import { RefreshCw } from "lucide-react";
import Markdown from "react-markdown";

import "./computed-summary-card.component.css";

type ComputedSummaryCardProps = {
  summary: ComputedSummaryData;
  viewName: string;
  source: string;
  isRecomputing: boolean;
  isAnyComputing: boolean;
  onRecompute: () => void;
};

const ComputedSummaryCard = ({
  summary,
  viewName,
  source,
  isRecomputing,
  isAnyComputing,
  onRecompute,
}: ComputedSummaryCardProps) => {
  const computedDate = new Date(summary.computedAt).toLocaleString();
  const groupEntries = Object.entries(summary.group);

  return (
    <div className="computed-summary-card">
      <div className="computed-summary-card__header">
        <div className="computed-summary-card__header-row">
          <h4 className="computed-summary-card__title">{viewName}</h4>
          <Tooltip title={isRecomputing ? "Recomputing..." : "Recompute"}>
            <span>
              <IconButton
                size="small"
                onClick={onRecompute}
                disabled={isAnyComputing}
                aria-label="Recompute"
                sx={{
                  color: "var(--fg-body)",
                  "&.Mui-disabled": { color: "var(--fg-body)", opacity: 0.4 },
                }}
              >
                {isRecomputing ? (
                  <CircularProgress size={14} sx={{ color: "var(--fg-body)" }} />
                ) : (
                  <RefreshCw size={16} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </div>
        <div className="computed-summary-card__meta">
          <span>Source: {source}</span>
          {groupEntries.map(([key, value]) => (
            <span key={key}>
              Group: {key} = {value}
            </span>
          ))}
          <span>Memories analyzed: {summary.memoryCount}</span>
          <span>Computed: {computedDate}</span>
        </div>
      </div>

      <div className="computed-summary-card__body">
        <Markdown>{summary.summary}</Markdown>
      </div>

      <div className="computed-summary-card__footer">
        Condensed from {summary.memoryCount} long-term memories.
      </div>
    </div>
  );
};

export { ComputedSummaryCard };
export type { ComputedSummaryCardProps };
