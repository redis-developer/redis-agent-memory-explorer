"use client";

import LinearProgress from "@mui/material/LinearProgress";

import "./playback-controls.component.css";

type PlaybackControlsProps = {
  currentChunk: number;
  totalChunks: number;
  isComplete: boolean;
};

const PlaybackControls = ({
  currentChunk,
  totalChunks,
  isComplete,
}: PlaybackControlsProps) => {
  const hasChunks = totalChunks > 0;
  const percentage = hasChunks ? (currentChunk / totalChunks) * 100 : 0;

  return (
    <div className="playback-controls">
      <LinearProgress
        variant="determinate"
        value={percentage}
        className="playback-controls__progress"
        sx={{
          height: 4,
          borderRadius: 2,
          backgroundColor: "var(--dusk-90)",
          "& .MuiLinearProgress-bar": {
            backgroundColor: isComplete
              ? "var(--color-episodic)"
              : "var(--primary-color)",
            borderRadius: 2,
          },
        }}
      />
      <div className="playback-controls__info">
        <span className="playback-controls__count">
          {currentChunk} / {totalChunks} chunks
        </span>
        <span className="playback-controls__percentage">
          {isComplete ? "Complete" : `${Math.round(percentage)}%`}
        </span>
      </div>
    </div>
  );
};

export { PlaybackControls };
export type { PlaybackControlsProps };
