"use client";

import type { ComputedSummaryData } from "@/types/memory.types";

import "./computed-summary-card.component.css";

type ComputedSummaryCardProps = {
  summary: ComputedSummaryData;
  viewName: string;
  source: string;
};

const ComputedSummaryCard = ({
  summary,
  viewName,
  source,
}: ComputedSummaryCardProps) => {
  const computedDate = new Date(summary.computedAt).toLocaleString();
  const groupEntries = Object.entries(summary.group);

  return (
    <div className="computed-summary-card">
      <div className="computed-summary-card__header">
        <h4 className="computed-summary-card__title">{viewName}</h4>
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
        <p className="computed-summary-card__text">{summary.summary}</p>
      </div>

      <div className="computed-summary-card__footer">
        Condensed from {summary.memoryCount} long-term memories.
      </div>
    </div>
  );
};

export { ComputedSummaryCard };
export type { ComputedSummaryCardProps };
