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
import { Play, ChevronLast, SkipForward, RotateCcw } from "lucide-react";
import { DropdownIcon } from "@/components/core";

import { PLAYBACK_STATUS, SPEED_SELECT_MIN_WIDTH } from "@/constants/app.constants";

import "./toolbar.component.css";

type ToolbarProps = {
  config: DatasetConfig;
  transcripts: TranscriptSummary[];
  selectedTranscriptId: string | null;
  usedTranscriptIds: Set<string>;
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

const SELECT_MENU_PROPS = {
  anchorOrigin: { vertical: "bottom", horizontal: "left" },
  transformOrigin: { vertical: "top", horizontal: "left" },
} as const;

const SELECT_SX = {
  color: "var(--fg-default)",
  fontSize: "var(--font-size-xs)",
  backgroundColor: "var(--dusk)",
  borderRadius: "var(--btn-border-radius-rounded)",
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--dusk-90)",
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--dusk-50)",
  },
} as const;

const Toolbar = ({
  config,
  transcripts,
  selectedTranscriptId,
  usedTranscriptIds,
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
  const allTranscriptsUsed = transcripts.length > 0 && usedTranscriptIds.size >= transcripts.length;

  return (
    <div className="toolbar">
      <Select
        value={selectedTranscriptId ?? ""}
        onChange={(e) => onSelectTranscript(e.target.value)}
        displayEmpty
        size="small"
        className="toolbar__select toolbar__select--transcript"
        disabled={isPlaying || isResetting}
        IconComponent={DropdownIcon}
        MenuProps={SELECT_MENU_PROPS}
        sx={SELECT_SX}
      >
        <MenuItem value="" disabled>
          {config.toolbar.transcriptDropdownLabel}
        </MenuItem>
        {transcripts.map((t) => {
          const isUsed = usedTranscriptIds.has(t.id);
          return (
            <MenuItem key={t.id} value={t.id} disabled={isUsed}>
              {t.date} - {t.type} ({t.chunkCount} chunks)
              {isUsed && (
                <span className="toolbar__used-hint">(session exists)</span>
              )}
            </MenuItem>
          );
        })}
        {allTranscriptsUsed && (
          <MenuItem disabled divider={false} className="toolbar__all-used-hint">
            Use session dropdown or Clear All
          </MenuItem>
        )}
      </Select>

      <Select
        value={playbackSpeed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        size="small"
        className="toolbar__select toolbar__select--speed"
        disabled={isPlaying || isResetting}
        IconComponent={DropdownIcon}
        MenuProps={SELECT_MENU_PROPS}
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
              {isPlaying ? <ChevronLast size={20} /> : <Play size={20} />}
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
              <SkipForward size={20} />
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
            <RotateCcw size={14} />
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
