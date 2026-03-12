"use client";

import "./transcript-chunk.component.css";

type TranscriptChunkProps = {
  timestamp: string;
  speaker: string;
  role: string;
  roleLabel: string;
  text: string;
  isNew: boolean;
  accentColor: string;
};

const TranscriptChunkComponent = ({
  timestamp,
  speaker,
  role,
  roleLabel,
  text,
  isNew,
  accentColor,
}: TranscriptChunkProps) => {
  const isRm = role === "rm";

  return (
    <div
      className={`transcript-chunk transcript-chunk--${role} ${isNew ? "transcript-chunk--new" : ""}`}
      style={isRm ? { "--chunk-accent": accentColor } as React.CSSProperties : undefined}
    >
      <div className="transcript-chunk__meta">
        <span className="transcript-chunk__timestamp">{timestamp}</span>
        <span className="transcript-chunk__speaker">
          {speaker} <span className="transcript-chunk__role">({roleLabel})</span>
        </span>
      </div>
      <div className="transcript-chunk__bubble">
        <p className="transcript-chunk__text">{text}</p>
      </div>
    </div>
  );
};

export { TranscriptChunkComponent };
export type { TranscriptChunkProps };
