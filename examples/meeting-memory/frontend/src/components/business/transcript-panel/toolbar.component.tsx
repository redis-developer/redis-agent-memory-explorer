"use client";

import type { DatasetConfig } from "@/types/dataset-config.types";
import type { TranscriptSummary } from "@/types/transcript.types";
import type { PlaybackStatusValue } from "./use-transcript-playback";

import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";

import { PLAYBACK_STATUS, SPEED_SELECT_MIN_WIDTH } from "@/constants/app.constants";

import "./toolbar.component.css";

type ToolbarProps = {
  config: DatasetConfig;
  transcripts: TranscriptSummary[];
  selectedTranscriptId: string | null;
  onSelectTranscript: (id: string) => void;
  playbackSpeed: number;
  onSpeedChange: (intervalMs: number) => void;
  playbackStatus: PlaybackStatusValue;
  isComplete: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onReset: () => void;
  isResetting: boolean;
};

const SELECT_SX = {
  color: "var(--fg-default)",
  fontSize: "var(--font-size-xs)",
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--border)",
  },
  "& .MuiSvgIcon-root": {
    color: "var(--fg-muted)",
  },
} as const;

const Toolbar = ({
  config,
  transcripts,
  selectedTranscriptId,
  onSelectTranscript,
  playbackSpeed,
  onSpeedChange,
  playbackStatus,
  isComplete,
  onPlay,
  onPause,
  onNext,
  onReset,
  isResetting,
}: ToolbarProps) => {
  const isPlaying = playbackStatus === PLAYBACK_STATUS.PLAYING;
  const hasTranscript = selectedTranscriptId !== null;
  const canStep = hasTranscript && !isPlaying && !isComplete && !isResetting;
  const playPauseLabel = isPlaying ? config.toolbar.pauseLabel : config.toolbar.playLabel;
  const playPauseDisabled = !hasTranscript || isComplete || isResetting;

  return (
    <div className="toolbar">
      <Select
        value={selectedTranscriptId ?? ""}
        onChange={(e) => onSelectTranscript(e.target.value)}
        displayEmpty
        size="small"
        className="toolbar__select toolbar__select--transcript"
        disabled={isPlaying || isResetting}
        sx={SELECT_SX}
      >
        <MenuItem value="" disabled>
          {config.toolbar.transcriptDropdownLabel}
        </MenuItem>
        {transcripts.map((t) => (
          <MenuItem key={t.id} value={t.id}>
            {t.date} - {t.type} ({t.chunkCount} chunks)
          </MenuItem>
        ))}
      </Select>

      <Select
        value={playbackSpeed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        size="small"
        className="toolbar__select toolbar__select--speed"
        disabled={isPlaying || isResetting}
        sx={{
          ...SELECT_SX,
          minWidth: SPEED_SELECT_MIN_WIDTH,
        }}
      >
        {config.playbackDefaults.speeds.map((s) => (
          <MenuItem key={s.intervalMs} value={s.intervalMs}>
            {s.label}
          </MenuItem>
        ))}
      </Select>

      <div className="toolbar__buttons">
        <Tooltip title={playPauseLabel}>
          <span>
            <IconButton
              onClick={isPlaying ? onPause : onPlay}
              disabled={playPauseDisabled}
              className="toolbar__play-pause-btn"
              size="small"
            >
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={config.toolbar.nextLabel}>
          <span>
            <IconButton
              onClick={onNext}
              disabled={!canStep}
              className="toolbar__next-btn"
              size="small"
            >
              <SkipNextIcon />
            </IconButton>
          </span>
        </Tooltip>
      </div>

      <Button
        onClick={onReset}
        disabled={isResetting}
        variant="contained"
        size="small"
        className="toolbar__reset-btn"
        startIcon={
          isResetting ? (
            <CircularProgress size={14} sx={{ color: "var(--base-white)" }} />
          ) : (
            <DeleteSweepIcon />
          )
        }
      >
        {config.toolbar.resetLabel}
      </Button>
    </div>
  );
};

export { Toolbar };
export type { ToolbarProps };
