"use client";

import type { DatasetConfig } from "@/types/dataset-config.types";
import type { TranscriptData, TranscriptSummary } from "@/types/transcript.types";
import type { AppendResult } from "@/types/memory.types";

import { useState, useCallback, useEffect, useRef } from "react";

import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

import { ConfirmDialog } from "@/components/core";
import {
  fetchTranscripts,
  fetchTranscript,
  createWorkingMemory,
  listWorkingMemorySessions,
  resetDemo,
} from "@/services/api.service";
import { PLAYBACK_STATUS, SESSION_ID_PATTERN } from "@/constants/app.constants";

import { Toolbar } from "./toolbar.component";
import { TranscriptFeed } from "./transcript-feed.component";
import { PlaybackControls } from "./playback-controls.component";
import { useTranscriptPlayback } from "./use-transcript-playback";
import { useBackendHealth } from "./use-backend-health";

import "./transcript-panel.component.css";

const formatSessionLabel = (sessionId: string): string => {
  const match = SESSION_ID_PATTERN.exec(sessionId);
  if (!match) {
    return sessionId;
  }

  const transcriptId = match[1];
  const timestamp = parseInt(match[2], 10);
  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${transcriptId} (${timeStr})`;
};

const parseTranscriptIdFromSessionId = (sessionId: string): string | null => {
  const match = SESSION_ID_PATTERN.exec(sessionId);
  const transcriptId = match ? match[1] : null;

  return transcriptId;
};

type TranscriptPanelProps = {
  datasetConfig: DatasetConfig;
  onSessionCreated: (sessionId: string) => void;
  onReset: () => void;
  onAppendResult?: (result: AppendResult) => void;
};

const TranscriptPanel = ({
  datasetConfig,
  onSessionCreated,
  onReset,
  onAppendResult,
}: TranscriptPanelProps) => {
  const [transcripts, setTranscripts] = useState<TranscriptSummary[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<string[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [transcriptsLoaded, setTranscriptsLoaded] = useState(false);
  const [playbackIntervalMs, setPlaybackIntervalMs] = useState(
    datasetConfig.playbackDefaults.intervalMs,
  );

  const hasSessions = sessions.length > 0;

  const pendingPlayRef = useRef(false);
  const pendingLoadAllRef = useRef(false);

  const { serverOk, isChecking: isHealthChecking } = useBackendHealth();

  const playback = useTranscriptPlayback(
    transcriptData?.chunks ?? [],
    sessionId,
    playbackIntervalMs,
  );

  useEffect(() => {
    if (!pendingPlayRef.current || !sessionId) return;
    pendingPlayRef.current = false;
    playback.start();
  }, [sessionId, playback.start]);

  useEffect(() => {
    if (!pendingLoadAllRef.current) return;
    const hasChunks = (transcriptData?.chunks?.length ?? 0) > 0;
    if (!hasChunks) return;

    pendingLoadAllRef.current = false;
    playback.loadAll();
  }, [transcriptData, playback]);

  useEffect(() => {
    if (playback.lastAppendResult && onAppendResult) {
      onAppendResult(playback.lastAppendResult);
    }
  }, [playback.lastAppendResult, onAppendResult]);

  const loadTranscriptList = useCallback(() => {
    if (transcriptsLoaded) return;
    fetchTranscripts()
      .then((res) => {
        setTranscripts(res.transcripts);
        setTranscriptsLoaded(true);
      })
      .catch((err: Error) => {
        console.error("Failed to load transcripts:", err.message);
      });
  }, [transcriptsLoaded]);

  const loadSessionList = useCallback(() => {
    listWorkingMemorySessions()
      .then((res) => {
        setSessions(res.sessions);
      })
      .catch((err: Error) => {
        console.error("Failed to load sessions:", err.message);
      });
  }, []);

  useEffect(() => {
    loadTranscriptList();
    loadSessionList();
  }, [loadTranscriptList, loadSessionList]);

  const handleSelectTranscript = useCallback(
    (transcriptId: string) => {
      setSelectedTranscriptId(transcriptId);
      playback.reset();
      setSessionId(null);

      fetchTranscript(transcriptId)
        .then((data) => {
          setTranscriptData(data);
        })
        .catch((err: Error) => {
          console.error("Failed to load transcript:", err.message);
        });
    },
    [playback],
  );

  const handleLoadSession = useCallback(
    (selectedSessionId: string) => {
      const transcriptId = parseTranscriptIdFromSessionId(selectedSessionId);
      if (!transcriptId) return;

      playback.reset();
      setSessionId(selectedSessionId);
      onSessionCreated(selectedSessionId);
      setSelectedTranscriptId(transcriptId);

      fetchTranscript(transcriptId)
        .then((data) => {
          setTranscriptData(data);
          pendingLoadAllRef.current = true;
        })
        .catch((err: Error) => {
          console.error("Failed to load transcript for session:", err.message);
        });
    },
    [playback, onSessionCreated],
  );

  const handlePlay = useCallback(() => {
    const hasNoTranscript = !selectedTranscriptId || !transcriptData;
    if (hasNoTranscript) return;

    const hasExistingSession = sessionId !== null;
    if (hasExistingSession) {
      playback.start();
      return;
    }

    createWorkingMemory(selectedTranscriptId)
      .then((res) => {
        setSessionId(res.sessionId);
        onSessionCreated(res.sessionId);
        pendingPlayRef.current = true;
      })
      .catch((err: Error) => {
        console.error("Failed to create session:", err.message);
      });
  }, [selectedTranscriptId, transcriptData, sessionId, playback, onSessionCreated]);

  const handleStop = useCallback(() => {
    playback.stop();
  }, [playback]);

  const handleResetConfirm = useCallback(() => {
    setIsResetting(true);
    setShowResetDialog(false);

    resetDemo()
      .then(() => {
        playback.reset();
        setSessionId(null);
        setSelectedTranscriptId(null);
        setTranscriptData(null);
        setSessions([]);
        setIsResetting(false);
        onReset();
      })
      .catch((err: Error) => {
        console.error("Reset failed:", err.message);
        setIsResetting(false);
      });
  }, [playback, onReset]);

  return (
    <div className="transcript-panel">
      <div className="transcript-panel__header">
        <h2 className="transcript-panel__title">{datasetConfig.transcriptPanel.title}</h2>
        {hasSessions && (
          <Select
            value={sessionId ?? ""}
            onChange={(e) => handleLoadSession(e.target.value)}
            displayEmpty
            size="small"
            className="transcript-panel__session-select"
            disabled={playback.isPlaying || isResetting}
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
              {datasetConfig.toolbar.sessionDropdownLabel}
            </MenuItem>
            {sessions.map((s) => (
              <MenuItem key={s} value={s}>
                {formatSessionLabel(s)}
              </MenuItem>
            ))}
          </Select>
        )}
      </div>

      <Toolbar
        config={datasetConfig}
        transcripts={transcripts}
        selectedTranscriptId={selectedTranscriptId}
        onSelectTranscript={handleSelectTranscript}
        playbackSpeed={playbackIntervalMs}
        onSpeedChange={setPlaybackIntervalMs}
        playbackStatus={playback.status}
        onPlay={handlePlay}
        onStop={handleStop}
        onReset={() => setShowResetDialog(true)}
        isResetting={isResetting}
        serverOk={serverOk}
        isHealthChecking={isHealthChecking}
      />

      <TranscriptFeed
        chunks={playback.displayedChunks}
        roles={datasetConfig.roles}
        participants={datasetConfig.participants}
        accentColor={datasetConfig.branding.accentColor}
        isPlaying={playback.isPlaying}
      />

      <PlaybackControls
        currentChunk={playback.currentIndex}
        totalChunks={playback.totalChunks}
        isComplete={playback.isComplete}
      />

      <ConfirmDialog
        open={showResetDialog}
        title="Clear All Memories & Restart"
        message="This will delete all working memory, long-term memories, and summary views for this dataset. Continue?"
        confirmLabel={datasetConfig.toolbar.resetLabel}
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetDialog(false)}
        isLoading={isResetting}
      />
    </div>
  );
};

export { TranscriptPanel };
export type { TranscriptPanelProps };
