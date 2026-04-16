"use client";

import type { ComputedSummaryData } from "@/types/memory.types";

import Button from "@mui/material/Button";
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
          <Button
            size="small"
            onClick={onRecompute}
            disabled={isAnyComputing}
            variant="outlined"
            startIcon={
              isRecomputing
                ? <CircularProgress size={12} sx={{ color: "var(--sky-blue)" }} />
                : <RefreshCw size={12} />
            }
            sx={{
              borderColor: "var(--sky-blue-09)",
              color: "var(--sky-blue)",
              textTransform: "none",
              fontSize: "var(--font-size-2xs)",
              padding: "2px 8px",
              minWidth: "auto",
              "&:hover": { borderColor: "var(--sky-blue)", backgroundColor: "color-mix(in srgb, var(--sky-blue) 10%, transparent)" },
              "&.Mui-disabled": { borderColor: "var(--sky-blue-09)", color: "var(--sky-blue)", opacity: 0.4 },
            }}
          >
            {isRecomputing ? "Recomputing..." : "Recompute"}
          </Button>
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
