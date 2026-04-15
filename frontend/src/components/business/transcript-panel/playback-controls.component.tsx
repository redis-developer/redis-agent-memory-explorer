"use client";

import type { PlaybackStatusValue } from "./use-transcript-playback";

import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";

import { StatusDot } from "@/components/core";
import { HEALTH_STATUS } from "@/constants/app.constants";

import "./playback-controls.component.css";

type PlaybackControlsProps = {
  currentChunk: number;
  totalChunks: number;
  playbackStatus: PlaybackStatusValue;
  statusText: string;
  serverOk: boolean;
  isHealthChecking: boolean;
  isResetting: boolean;
};

const PlaybackControls = ({
  currentChunk,
  totalChunks,
  playbackStatus,
  statusText,
  serverOk,
  isHealthChecking,
  isResetting,
}: PlaybackControlsProps) => {
  const hasChunks = totalChunks > 0;
  const percentage = hasChunks ? (currentChunk / totalChunks) * 100 : 0;
  const healthStatus = isHealthChecking
    ? HEALTH_STATUS.CHECKING
    : serverOk
      ? HEALTH_STATUS.OK
      : HEALTH_STATUS.ERROR;

  return (
    <div className="playback-controls">
      <div className="playback-controls__health">
        <StatusDot status={healthStatus} />
        <span className="playback-controls__health-label">
          {serverOk ? "Connected" : "Disconnected"}
        </span>
      </div>

      <LinearProgress
        variant="determinate"
        value={percentage}
        className="playback-controls__progress"
        sx={{
          height: 4,
          borderRadius: 2,
          backgroundColor: "var(--dusk-90)",
          "& .MuiLinearProgress-bar": {
            backgroundColor: percentage >= 100
              ? "var(--color-episodic)"
              : "var(--sky-blue)",
            borderRadius: 2,
          },
        }}
      />

      <span className="playback-controls__count">
        {currentChunk} / {totalChunks} chunks
      </span>

      <Chip
        label={isResetting ? "Resetting..." : statusText}
        size="small"
        className={`playback-controls__status-chip playback-controls__status-chip--${playbackStatus}`}
      />
    </div>
  );
};

export { PlaybackControls };
export type { PlaybackControlsProps };
