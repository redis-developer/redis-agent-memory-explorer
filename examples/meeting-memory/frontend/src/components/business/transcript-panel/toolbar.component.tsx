"use client";

import type { DatasetConfig, RoleConfig, ParticipantConfig } from "@/types/dataset-config.types";
import type { TranscriptSummary } from "@/types/transcript.types";
import type { PlaybackStatusValue } from "./use-transcript-playback";

import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";

import { StatusDot } from "@/components/core";
import { PLAYBACK_STATUS, HEALTH_STATUS, SPEED_SELECT_MIN_WIDTH } from "@/constants/app.constants";

import "./toolbar.component.css";

type ToolbarProps = {
  config: DatasetConfig;
  transcripts: TranscriptSummary[];
  selectedTranscriptId: string | null;
  onSelectTranscript: (id: string) => void;
  playbackSpeed: number;
  onSpeedChange: (intervalMs: number) => void;
  playbackStatus: PlaybackStatusValue;
  onPlay: () => void;
  onStop: () => void;
  onReset: () => void;
  isResetting: boolean;
  serverOk: boolean;
  isHealthChecking: boolean;
};

const Toolbar = ({
  config,
  transcripts,
  selectedTranscriptId,
  onSelectTranscript,
  playbackSpeed,
  onSpeedChange,
  playbackStatus,
  onPlay,
  onStop,
  onReset,
  isResetting,
  serverOk,
  isHealthChecking,
}: ToolbarProps) => {
  const isPlaying = playbackStatus === PLAYBACK_STATUS.PLAYING;
  const isIdle = playbackStatus === PLAYBACK_STATUS.IDLE;
  const statusText = config.statusLabels[playbackStatus] ?? playbackStatus;
  const healthStatus = isHealthChecking ? HEALTH_STATUS.CHECKING : serverOk ? HEALTH_STATUS.OK : HEALTH_STATUS.ERROR;

  const handleTranscriptChange = (value: string) => {
    onSelectTranscript(value);
  };

  return (
    <div className="toolbar">
      <div className="toolbar__row toolbar__row--top">
        <div className="toolbar__health">
          <StatusDot status={healthStatus} />
          <span className="toolbar__health-label">
            {serverOk ? "Connected" : "Disconnected"}
          </span>
        </div>

        <Chip
          label={isResetting ? "Resetting..." : statusText}
          size="small"
          className={`toolbar__status-chip toolbar__status-chip--${playbackStatus}`}
        />
      </div>

      <div className="toolbar__row toolbar__row--controls">
        <Select
          value={selectedTranscriptId ?? ""}
          onChange={(e) => handleTranscriptChange(e.target.value)}
          displayEmpty
          size="small"
          className="toolbar__select toolbar__select--transcript"
          disabled={isPlaying || isResetting}
          sx={{
            color: "var(--fg-default)",
            fontSize: "var(--font-size-xs)",
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: "var(--border)",
            },
            "& .MuiSvgIcon-root": {
              color: "var(--fg-muted)",
            },
          }}
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
            color: "var(--fg-default)",
            fontSize: "var(--font-size-xs)",
            minWidth: SPEED_SELECT_MIN_WIDTH,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: "var(--border)",
            },
            "& .MuiSvgIcon-root": {
              color: "var(--fg-muted)",
            },
          }}
        >
          {config.playbackDefaults.speeds.map((s) => (
            <MenuItem key={s.intervalMs} value={s.intervalMs}>
              {s.label}
            </MenuItem>
          ))}
        </Select>

        <div className="toolbar__buttons">
          <Tooltip title={config.toolbar.playLabel}>
            <span>
              <IconButton
                onClick={onPlay}
                disabled={isPlaying || !selectedTranscriptId || isResetting}
                className="toolbar__play-btn"
                size="small"
              >
                <PlayArrowIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={config.toolbar.stopLabel}>
            <span>
              <IconButton
                onClick={onStop}
                disabled={!isPlaying || isResetting}
                className="toolbar__stop-btn"
                size="small"
              >
                <StopIcon />
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
    </div>
  );
};

export { Toolbar };
export type { ToolbarProps };
