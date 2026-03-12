"use client";

import "./working-memory-summary.component.css";

type WorkingMemorySummaryProps = {
  context: string;
  label: string;
};

const WorkingMemorySummary = ({ context, label }: WorkingMemorySummaryProps) => {
  return (
    <div className="working-memory-summary">
      <h4 className="working-memory-summary__label">{label}</h4>
      <div className="working-memory-summary__content">
        <p className="working-memory-summary__text">{context}</p>
      </div>
    </div>
  );
};

export { WorkingMemorySummary };
export type { WorkingMemorySummaryProps };
